import { Leveling } from "../../../shared/Class/Leveling";
import { Quest, QuestObjective, QuestStatus, QuestUpdate, ServerMsg } from "../../../shared/types";
import Logger from "../../utils/Logger";
import { BrainSchema, LootSchema, PlayerSchema, QuestSchema } from "../schema";
import { GameRoomState } from "../state/GameRoomState";
import { calculateSaturatedGoldBalance, isQuestDefinition, isQuestProgressComplete } from "../gameplayRules";

const QUEST_ACTIVE_STATUS = 0;
const QUEST_COMPLETED_STATUS = 1;
const MAX_QUEST_PROGRESS = 32767;

export class dynamicCTRL {
    private _state: GameRoomState;
    private _player: PlayerSchema;
    private _dynamic;

    constructor(player) {
        this._player = player;
        this._state = player._state;
    }

    public update() {
        //
        let interactive = this._state.roomDetails.dynamic.interactive ?? [];
        if (interactive.length > 0) {
            let currentPos = this._player.getPosition();
            interactive.forEach((element) => {
                let distanceTo = currentPos.distanceTo(element.from);

                if (distanceTo < 2) {
                    if (element.type === "teleport") {
                        this._player.x = element.to_vector.x;
                        this._player.y = element.to_vector.y;
                        this._player.z = element.to_vector.z;
                    }

                    if (element.type == "zone_change" && this._player.isTeleporting === false) {
                        this._player.isTeleporting = true;

                        const client = this._state._gameroom.clients.getById(this._player.sessionId);
                        if (!client) {
                            this._player.isTeleporting = false;
                            return;
                        }

                        const previousState = {
                            location: this._player.location,
                            x: this._player.x,
                            y: this._player.y,
                            z: this._player.z,
                            rot: this._player.rot,
                        };

                        // update player location in database
                        this._player.location = element.to_map;
                        this._player.x = element.to_vector.x;
                        this._player.y = element.to_vector.y;
                        this._player.z = element.to_vector.z;
                        this._player.rot = 0;

                        // Persist the destination before the client joins its new
                        // room: room authentication verifies the saved location.
                        // Using GameRoom's queue also prevents this transition
                        // from racing a periodic or disconnect save.
                        void this._state._gameroom
                            .persistPlayer(this._player)
                            .then(() => {
                                if (this._player.getClient() === client) {
                                    client.send(ServerMsg.PLAYER_TELEPORT, element.to_map);
                                }
                            })
                            .catch((error) => {
                                Object.assign(this._player, previousState);
                                this._player.isTeleporting = false;
                                Logger.error(
                                    `[dynamicCTRL] failed to persist zone change to ${element.to_map}.`,
                                    error
                                );
                            });
                    }
                }
            });
        }
    }

    ////////////////////////////////
    //////////// QUESTS /////////////
    ////////////////////////////////

    // check quest update
    // note: currently called from abilityCtrl when a entity dies
    checkQuestUpdate(type, target: BrainSchema) {
        //
        if (type === "kill" && target.AI_SPAWN_INFO) {
            this._player.player_data.quests.forEach((element: QuestSchema) => {
                if (
                    element.status === QUEST_ACTIVE_STATUS &&
                    element.type === QuestObjective.KILL_AMOUNT &&
                    element.spawn_key === target.AI_SPAWN_INFO.key
                ) {
                    const quest = this._state.gameData.get("quest", element.key) as Quest;
                    const maximum = Number.isSafeInteger(quest?.quantity)
                        ? Math.min(Math.max(quest.quantity, 0), MAX_QUEST_PROGRESS)
                        : MAX_QUEST_PROGRESS;
                    element.qty = Math.min(element.qty + 1, maximum);
                }
            });
        }
    }

    isQuestReadyToComplete(quest: Quest) {
        if (!quest) {
            return false;
        }
        const playerQuest = this._player.player_data.quests.get(quest.key);
        return isQuestProgressComplete(quest, playerQuest);
    }

    questUpdate(data: QuestUpdate) {
        if (!data || typeof data.key !== "string" || !Number.isInteger(data.status)) {
            return false;
        }

        const quest = this._state.gameData.get("quest", data.key);

        if (!isQuestDefinition(quest, data.key)) {
            return false;
        }

        if (data.status === QuestStatus.ACCEPTED) {
            const existingQuest = this._player.player_data.quests.get(quest.key);
            if (existingQuest && (existingQuest.status === QUEST_ACTIVE_STATUS || !quest.isRepeatable)) {
                return false;
            }

            this._player.player_data.quests.set(
                quest.key,
                new QuestSchema({ ...quest, status: QUEST_ACTIVE_STATUS, qty: 0 })
            );
            return true;
        }

        if (data.status === QuestStatus.READY_TO_COMPLETE) {
            // check is quest in complete
            if (!this.isQuestReadyToComplete(quest)) return false;

            // find player quest
            let playerQuest = this._player.player_data.quests.get(data.key);
            if (!playerQuest) {
                return false;
            }

            // experience
            let experienceReward = quest.rewards.experience ?? 0;
            if (experienceReward) {
                Leveling.addExperience(this._player, experienceReward);
            }

            // gold
            let goldReward = quest.rewards.gold ?? 0;
            if (goldReward) {
                const updatedBalance = calculateSaturatedGoldBalance(this._player.player_data.gold, goldReward);
                if (updatedBalance !== null) {
                    this._player.player_data.gold = updatedBalance;
                }
            }

            // add items
            let items = quest.rewards.items ?? [];
            items.forEach((item) => {
                this._player.pickupItem(new LootSchema(this._state, item));
            });

            // remove quest as it is completed
            // later on we will save a history, not necessary yet..
            //this._player.player_data.quests.delete(quest.key);
            playerQuest.status = QUEST_COMPLETED_STATUS;
            return true;
        }

        return false;
    }
}
