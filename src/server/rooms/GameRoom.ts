import { Room, Client, Delayed, AuthContext } from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import { GameRoomState } from "./state/GameRoomState";
import loadNavMeshFromFile from "../utils/loadNavMeshFromFile";
import Logger from "../utils/Logger";
import { NavMesh } from "../../shared/Libs/yuka-min";
import { Auth } from "./commands";
import { PlayerSchema } from "./schema";
import { Database } from "../Database";
import { Config } from "../../shared/Config";
import {
    activatePlayerSession,
    finalizePlayerSession,
    reservePlayerSession,
    unregisterPlayerSession,
} from "./PlayerSessionRegistry";
import { GameData } from "../GameData";
import { getKnownRoomLocation } from "./gameplayRules";
import { createPlayerPersistenceSnapshot, persistPlayerSnapshot } from "./playerPersistence";
import { GameplayMessageGuard, dispatchGameplayMessageSafely } from "./GameplayMessageGuard";

export class GameRoom extends Room<{ state: GameRoomState }> {
    public maxClients = 64;
    public maxMessagesPerSecond = 60;
    public database: any;
    public delayedInterval!: Delayed;
    public navMesh: NavMesh;
    public config;

    public disposeTimer;
    private persistenceByCharacterId = new Map<number, Promise<void>>();
    private gameplayMessageGuard = new GameplayMessageGuard();

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // on create room event
    async onCreate(options: any) {
        const location = getKnownRoomLocation(options?.location, GameData.load("locations"));
        if (!location) {
            throw new Error("Invalid game room location.");
        }

        Logger.info("[gameroom][onCreate] game room created: " + this.roomId + " (" + location + ")");

        // Matchmaking metadata is public. Never copy authentication options into it.
        this.setMetadata({ location });

        this.config = new Config();

        // initialize navmesh
        const navMesh = await loadNavMeshFromFile(location);
        this.navMesh = navMesh;
        Logger.info("[gameroom][onCreate] navmesh " + location + " initialized.");

        // Publish the room state only after all asynchronous controllers are ready.
        const state = new GameRoomState(this, this.navMesh, { location });
        await state.init();
        this.setState(state);

        // Register message handlers for messages from the client
        this.registerMessageHandlers();

        //Set frequency the patched state should be sent to all clients
        this.setPatchRate(this.config.updateRate);

        //Set a simulation interval that can change the state of the game
        this.setTimestep((dt) => {
            this.state.update(dt);
        }, this.config.updateRate);

        // set max clients
        this.maxClients = this.config.maxClients;
        this.autoDispose = true;

        // initialize database
        this.database = new Database(this.config);
        await this.database.init();

        ///////////////////////////////////////////////////////////////////////////
        // if players are in a room, make sure we save any changes to the database.
        // only save if there is any players
        this.delayedInterval = this.clock.setInterval(() => {
            if (this.state.entities && this.state.entities.size > 0) {
                this.state.entityCTRL.all.forEach((entity) => {
                    if (entity instanceof PlayerSchema) {
                        void this.persistPlayer(entity).catch((error) => {
                            Logger.error(`[gameroom][save] periodic save failed for character ${entity.id}.`, error);
                        });
                    }
                });
            }
        }, this.config.databaseUpdateRate);
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // authorize client based on provided options before WebSocket handshake is complete
    async onAuth(client: Client, authData: any, _context: AuthContext) {
        const character = await Auth.check(this.database, authData, this.metadata?.location);
        if (!character) {
            return false;
        }

        if (!reservePlayerSession(Number(character.id), client.sessionId)) {
            Logger.warning(`[gameroom][onAuth] character ${character.id} already has a live or pending session.`);
            return false;
        }

        return character;
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // on client join
    async onJoin(client: Client, options: any) {
        const characterId = Number(client.auth?.id);
        if (!activatePlayerSession(characterId, client.sessionId)) {
            throw new Error("Player session reservation was lost before join.");
        }

        let playerAdded = false;
        try {
            client.view = new StateView();
            const player = this.state.addPlayer(client);
            client.view.add(player);
            playerAdded = true;
            await this.database.toggleOnlineStatus(characterId, 1);
        } catch (error) {
            if (playerAdded) {
                this.state.deleteEntity(client.sessionId);
                this.state.removeTarget(client.sessionId);
            }

            if (unregisterPlayerSession(characterId, client.sessionId)) {
                try {
                    await this.database.toggleOnlineStatus(characterId, 0);
                } catch (statusError) {
                    Logger.error(`[gameroom][onJoin] failed to reset online status for character ${characterId}.`, statusError);
                }
            }
            throw error;
        }
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // client message handler

    private registerMessageHandlers() {
        /////////////////////////////////////
        // on player input
        this.onMessage("*", (client, type, data) => {
            if (!this.gameplayMessageGuard.allow(client.sessionId, type)) {
                return;
            }
            dispatchGameplayMessageSafely(this.state, client, type, data, (error) => {
                Logger.error(`[gameroom][message] rejected malformed message ${String(type)}.`, error);
            });
        });
    }

    onUncaughtException(error: unknown, methodName: string) {
        Logger.error(`[gameroom][${methodName}] uncaught room exception.`, error);
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // when a client leaves the room
    async onLeave(client: Client, code?: number) {
        this.gameplayMessageGuard.remove(client.sessionId);
        const characterId = Number(client.auth?.id);
        const player = this.state?.getEntity(client.sessionId);

        // A normal quit and an interrupted socket both need the same durable
        // final save. Keep the reservation until all writes and online=0 have
        // completed so a replacement connection cannot race this cleanup.
        const ownsSession = await finalizePlayerSession(characterId, client.sessionId, {
            save: player instanceof PlayerSchema ? () => this.persistPlayer(player) : undefined,
            remove: () => {
                if (this.state?.entityCTRL) {
                    if (player) {
                        this.state.deleteEntity(client.sessionId);
                    }

                    // Make sure no remaining entity still targets the departing player.
                    this.state.removeTarget(client.sessionId);
                }
            },
            markOffline:
                this.database && Number.isSafeInteger(characterId) && characterId > 0
                    ? () => this.database.toggleOnlineStatus(characterId, 0)
                    : undefined,
            onError: (stage, error) => {
                Logger.error(`[gameroom][onLeave] ${stage} failed for character ${characterId}.`, error);
            },
        });

        if (!ownsSession) {
            Logger.warning(`[gameroom][onLeave] ignored stale session persistence for character ${characterId}.`);
        }

        // log
        Logger.info(
            `[onLeave] player ${client.auth?.name ?? client.sessionId} left (close code ${code ?? "unknown"})`
        );
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // cleanup callback, called after there are no more clients in the room. (see `autoDispose`)
    async onDispose() {
        this.gameplayMessageGuard.clear();
        this.delayedInterval?.clear();
        const pendingSaves = Array.from(this.persistenceByCharacterId.values());
        if (pendingSaves.length > 0) {
            await Promise.allSettled(pendingSaves);
        }

        if (this.database) {
            try {
                await this.database.close();
            } catch (error) {
                Logger.error("[onDispose] failed to close game-room database connection.", error);
            }
        }

        Logger.warning(`[onDispose] game room removed. `);
    }

    public persistPlayer(player: PlayerSchema): Promise<void> {
        const characterId = Number(player?.id);
        if (!Number.isSafeInteger(characterId) || characterId <= 0) {
            return Promise.reject(new Error("Cannot save a player without a valid character ID."));
        }

        // Capture values now instead of letting queued writes observe a later,
        // partially-mutated schema. Persist base stats so equipped modifiers are
        // not permanently added again on every login.
        const snapshot = createPlayerPersistenceSnapshot(player);

        const previousSave = this.persistenceByCharacterId.get(characterId) ?? Promise.resolve();
        const currentSave = previousSave.catch(() => undefined).then(async () => {
            await persistPlayerSnapshot(this.database, characterId, snapshot);
            Logger.info(`[gameroom][save] character ${characterId} saved to database.`);
        });

        this.persistenceByCharacterId.set(characterId, currentSave);
        void currentSave.then(
            () => {
                if (this.persistenceByCharacterId.get(characterId) === currentSave) {
                    this.persistenceByCharacterId.delete(characterId);
                }
            },
            () => {
                if (this.persistenceByCharacterId.get(characterId) === currentSave) {
                    this.persistenceByCharacterId.delete(characterId);
                }
            }
        );
        return currentSave;
    }
}
