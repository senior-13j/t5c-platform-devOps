import { Client } from "colyseus";
import { Schema, type, MapSchema, filterChildren } from "@colyseus/schema";
import { BrainSchema, Entity, EquipmentSchema, LootSchema, PlayerSchema } from "../schema";

import { spawnCTRL } from "../controllers/spawnCTRL";
import { entityCTRL } from "../controllers/entityCTRL";
import { gameDataCTRL } from "../controllers/gameDataCTRL";

import { GameRoom } from "../GameRoom";

import { NavMesh, Vector3 } from "../../../shared/Libs/yuka-min";
import Logger from "../../utils/Logger";
import { ItemClass, ServerMsg, Speed } from "../../../shared/types";
import { Config } from "../../../shared/Config";
import { canProcessDebugMessages } from "../gameplayRules";

const DEBUG_MESSAGE_TYPES = new Set<ServerMsg>([
    ServerMsg.DEBUG_BOTS,
    ServerMsg.DEBUG_INCREASE_ENTITIES,
    ServerMsg.DEBUG_DECREASE_ENTITIES,
    ServerMsg.DEBUG_REMOVE_ENTITIES,
]);

export class GameRoomState extends Schema {
    // networked variables
    /*
    @filterChildren(function (client, key, value: BrainSchema | LootSchema | PlayerSchema, root) {
        const isSelf = value.sessionId === client.sessionId;
        const player = (this as GameRoomState).entityCTRL.get(client.sessionId);
        const isWithinXBounds = Math.abs(player.x - value.x) < Config.PLAYER_VIEW_DISTANCE;
        const isWithinZBounds = Math.abs(player.z - value.z) < Config.PLAYER_VIEW_DISTANCE;
        const isWithinBounds = isWithinXBounds && isWithinZBounds;
        return isSelf || isWithinBounds;
    })*/
    @type({ map: Entity }) entities = new MapSchema<BrainSchema | LootSchema | PlayerSchema>();

    @type("number") serverTime: number = 0.0;

    // not networked variables
    public _gameroom: GameRoom = null;
    public spawnCTRL: spawnCTRL;
    public navMesh: NavMesh = null;
    public entityCTRL: entityCTRL;
    public gameData: gameDataCTRL;

    public config: Config;
    public roomDetails;

    private spawnTimer = 0;
    private spawnInterval = 60000;

    constructor(gameroom: GameRoom, _navMesh: NavMesh, ...args: any[]) {
        super(...args);
        this._gameroom = gameroom;
        this.config = gameroom.config;
        this.navMesh = _navMesh;
    }

    public async init(): Promise<void> {
        // load game data
        // in the future, it'll be in the database
        this.gameData = new gameDataCTRL();
        await this.gameData.initialize();

        // get location details
        this.roomDetails = this.gameData.get("location", this._gameroom.metadata.location);

        // load controllers
        this.entityCTRL = new entityCTRL(this);
        this.spawnCTRL = new spawnCTRL(this);
    }

    public update(deltaTime: number) {
        // updating entities
        if (this.entityCTRL.hasEntities()) {
            this.entityCTRL.all.forEach((entity) => {
                entity.update(deltaTime);
                // todo: remove item/loot that's been on the ground over 5 minutes
            });
        }

        // update spawn controller
        this.spawnCTRL.update(deltaTime);
    }

    getEntity(sessionId) {
        return this.entityCTRL.get(sessionId);
    }

    deleteEntity(sessionId) {
        this.entities.delete(sessionId);
    }

    removeTarget(sessionId) {
        this.entityCTRL.all.forEach((entity) => {
            if (entity.type === "entity" && entity.AI_TARGET && entity.AI_TARGET.sessionId === sessionId) {
                entity.AI_TARGET = null;
            }
        });
    }

    /**
     * Add player
     * @param client
     */
    addPlayer(client: Client): void {
        // prepare player data
        let data = client.auth;

        let player_data = {
            strength: data.strength ?? 0,
            endurance: data.endurance ?? 0,
            agility: data.agility ?? 0,
            intelligence: data.intelligence ?? 0,
            wisdom: data.wisdom ?? 0,
            experience: data.experience ?? 0,
            gold: data.gold ?? 0,
            points: data.points ?? 0,
        };

        let player = {
            id: data.id,

            x: data.x ?? 0,
            y: data.y ?? 0,
            z: data.z ?? 0,
            rot: data.rot ?? 0,

            health: data.health,
            maxHealth: data.health,
            mana: data.mana,
            maxMana: data.mana,
            level: data.level,

            sessionId: client.sessionId,
            name: data.name,
            type: "player",
            race: data.race,
            material: data.material,
            head: data.head,

            location: data.location,
            sequence: 0,
            blocked: false,

            initial_player_data: player_data,
            initial_abilities: data.abilities ?? [],
            initial_inventory: data.inventory ?? [],
            initial_equipment: data.equipment ?? [],
            initial_quests: data.quests ?? [],
            initial_hotbar: data.hotbar ?? [],
        };

        this.entityCTRL.add(new PlayerSchema(this, player));

        // log
        Logger.info(`[gameroom][onJoin] player ${client.sessionId} joined room ${this._gameroom.roomId}.`);
    }

    processMessage(client, type, data) {
        ////////////////////////////////////
        ////////// SERVER EVENTS ///////////
        ////////////////////////////////////

        if (type !== ServerMsg.PING) {
            Logger.info(`[gameroom][` + ServerMsg[type] + `] player message`, data);
        }

        if (type === ServerMsg.PING) {
            client.send(ServerMsg.PONG, data);
            return true;
        }

        ////////////////////////////////////
        ////////// PLAYER EVENTS ///////////
        ////////////////////////////////////
        const playerState: PlayerSchema = this.getEntity(client.sessionId) as PlayerSchema;
        if (!playerState) {
            return false;
        }

        /////////////////////////////////////
        // on player ressurect
        if (type === ServerMsg.PLAYER_RESSURECT) {
            if (!playerState.isDead) {
                return false;
            }
            playerState.ressurect();
            return true;
        }

        // make sure player is not dead
        if (playerState.isDead) {
            return false;
        }

        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        /////////////////////////////////////
        // on player reset position
        if (type === ServerMsg.PLAYER_RESET_POSITION) {
            return playerState.resetPosition();
        }

        /////////////////////////////////////
        // on player learn skill
        if (type === ServerMsg.PLAYER_LEARN_SKILL) {
            //playerState.abilitiesCTRL.learnAbility(data.key);
        }

        /////////////////////////////////////
        // on player add stat point
        if (type === ServerMsg.PLAYER_ADD_STAT_POINT) {
            const allowedStats = new Set(["strength", "agility", "endurance", "intelligence", "wisdom"]);
            const key = typeof data?.key === "string" ? data.key : "";
            if (!allowedStats.has(key)) {
                return false;
            }
            if (playerState.player_data.points > 0) {
                // remove point
                playerState.player_data.points -= 1;

                // update controller
                playerState.statsCTRL.updateBaseStats(key, 1);
            }
        }

        /////////////////////////////////////
        // on player input
        if (type === ServerMsg.PLAYER_MOVE) {
            playerState.moveCTRL.processPlayerInput(data);
        }

        // on player click to move
        if (type === ServerMsg.PLAYER_MOVE_TO) {
            const x = Number(data?.x);
            const y = Number(data?.y);
            const z = Number(data?.z);
            if (![x, y, z].every(Number.isFinite)) {
                return false;
            }
            //playerState.abilitiesCTRL.cancelAutoAttack(playerState);
            playerState.moveCTRL.setTargetDestination(new Vector3(x, y, z));
        }

        /////////////////////////////////////
        // on player ressurect
        if (type === ServerMsg.PLAYER_PICKUP) {
            //playerState.abilitiesCTRL.cancelAutoAttack(playerState);
            const sessionId = typeof data?.sessionId === "string" ? data.sessionId : "";
            const itemState = sessionId ? this.getEntity(sessionId) : null;
            if (itemState) {
                playerState.setTarget(itemState);
            }
        }

        if (type === ServerMsg.PLAYER_DROP_ITEM) {
            const slot = data?.slot;
            const dropAll = data?.drop_all === true;
            const item = playerState.getInventoryItemByIndex(slot);
            if (item) {
                playerState.dropItem(item, dropAll);
            }
        }

        if (type === ServerMsg.PLAYER_BUY_ITEM) {
            const key = typeof data?.key === "string" ? data.key : "";
            const item = key ? this.gameData.get("item", key) : null;
            if (item) {
                playerState.buyItem(item, data?.qty);
            }
        }

        if (type === ServerMsg.PLAYER_SELL_ITEM) {
            const index = data?.index;
            const item = playerState.getInventoryItemByIndex(index);
            if (item) {
                playerState.sellItem(item);
            }
        }

        /////////////////////////////////////
        // on player equip
        // data will equal the inventory index of the clicked item
        if (type === ServerMsg.PLAYER_USE_ITEM) {
            const index = data?.index;
            const item = playerState.getInventoryItemByIndex(index);
            if (item) {
                if (item.class === ItemClass.CONSUMABLE) {
                    playerState.consumeItem(item);
                } else if (item.equippable) {
                    playerState.equipItem(item);
                }
            }
        }

        /////////////////////////////////////
        // on player unequip
        if (type === ServerMsg.PLAYER_UNEQUIP_ITEM) {
            const key = typeof data?.key === "string" ? data.key : "";
            const equippedItem = key ? playerState.equipment.get(key) : null;
            if (equippedItem) {
                return playerState.unequipItem(key, equippedItem.slot);
            }
            return false;
        }

        /////////////////////////////////////
        // on player unequip
        if (type === ServerMsg.PLAYER_QUEST_UPDATE) {
            if (data && typeof data.key === "string" && Number.isInteger(data.status)) {
                playerState.dynamicCTRL.questUpdate(data);
            }
        }

        /////////////////////////////////////
        // player entity_attack
        if (type === ServerMsg.PLAYER_HOTBAR_ACTIVATED) {
            const digit = Number(data?.digit);
            if (!Number.isSafeInteger(digit) || digit < 1 || digit > this.config.PLAYER_HOTBAR_SIZE) {
                return false;
            }

            // get players involved
            const targetId = typeof data?.targetId === "string" ? data.targetId : "";
            let targetState = targetId ? (this.getEntity(targetId) as Entity) : null;
            let hotbarData = playerState.player_data.hotbar.get("" + digit);

            Logger.warning(`[ServerMsg.PLAYER_HOTBAR_ACTIVATED]`, digit);

            if (!hotbarData) {
                return false;
            }

            // if item
            if (hotbarData && hotbarData.type === "item") {
                const item = playerState.getInventoryItem(hotbarData.key, "key");
                if (item && item.class === ItemClass.CONSUMABLE) {
                    playerState.consumeItem(item);
                }
                return false;
            }

            // if ability
            if (hotbarData && hotbarData.type === "ability") {
                playerState.abilitiesCTRL.addAbility(playerState, targetState, { ...data, digit });
                return false;
            }
        }

        /////////
        /////// DEBUG /////////////////

        if (DEBUG_MESSAGE_TYPES.has(type)) {
            if (!canProcessDebugMessages()) {
                Logger.warning(`[gameroom] rejected debug message outside development`, ServerMsg[type]);
                return false;
            }

            if (type === ServerMsg.DEBUG_BOTS) {
                this.spawnCTRL.debug_bots();
                return true;
            }

            if (type === ServerMsg.DEBUG_REMOVE_ENTITIES && this.entityCTRL.hasEntities()) {
                this.entityCTRL.all.forEach((entity) => {
                    if (entity.type !== "player") {
                        this.spawnCTRL.removeEntity(entity);
                    }
                });
                return true;
            }

            return false;
        }

        return false;
    }
}
