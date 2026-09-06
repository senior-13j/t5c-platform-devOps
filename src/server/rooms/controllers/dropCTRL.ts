import Logger from "../../utils/Logger";
import { Leveling } from "../../../shared/Class/Leveling";
import { randomNumberInRange } from "../../../shared/Utils";
import { GetLoot } from "../../../shared/Class/LootTable";
import { nanoid } from "nanoid";
import { LootSchema } from "../schema/LootSchema";
import { PlayerSchema } from "../schema";
import { ServerMsg } from "../../../shared/types";
import { calculateSaturatedGoldBalance } from "../gameplayRules";

export class dropCTRL {
    private _owner: PlayerSchema;
    private _client;

    constructor(owner, client) {
        this._owner = owner;
        this._client = client;
    }

    public addExperience(target) {
        // calculate experience total
        let exp = target.experienceGain;
        if (target.AI_SPAWN_INFO && target.AI_SPAWN_INFO.experienceGain) {
            exp = target.AI_SPAWN_INFO.experienceGain;
        }
        let amount = Math.floor(randomNumberInRange(exp.min, exp.max));
        Leveling.addExperience(this._owner, amount);
        console.log("[addExperience]", amount);
    }

    public addGold(target) {
        let goldGains = target.goldGain;
        if (target.AI_SPAWN_INFO && target.AI_SPAWN_INFO.goldGain) {
            goldGains = target.AI_SPAWN_INFO.goldGain;
        }
        const minimum = Number(goldGains?.min);
        const maximum = Number(goldGains?.max);
        if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum < minimum) {
            return false;
        }

        const rolledGold = Math.floor(randomNumberInRange(minimum, maximum));
        const previousBalance = this._owner.player_data.gold;
        const updatedBalance = calculateSaturatedGoldBalance(previousBalance, rolledGold);
        if (updatedBalance === null) {
            return false;
        }

        this._owner.player_data.gold = updatedBalance;
        const awardedGold = updatedBalance - previousBalance;
        Logger.info(`[gameroom][addGold] player has gained ${awardedGold} gold, total: ${updatedBalance}`);

        if (awardedGold > 0) {
            // Inform the player of the amount actually credited after saturation.
            this._client.send(ServerMsg.SERVER_MESSAGE, {
                type: "event",
                message: "You pick up " + awardedGold + " worth of gold.",
                date: new Date(),
            });
        }
        return true;
    }

    public dropItems(target) {
        let items = target.AI_SPAWN_INFO.drops ?? [];
        let loot = GetLoot(items);
        loot.forEach((drop) => {
            // drop item on the ground
            let sessionId = nanoid(10);
            let currentPosition = target.getPosition();
            currentPosition.x += randomNumberInRange(-2, 2);
            currentPosition.z += randomNumberInRange(-2, 2);
            let data = {
                key: drop.id,
                name: "Apple",
                sessionId: sessionId,
                x: currentPosition.x,
                y: 0.25,
                z: currentPosition.z,
                qty: drop.quantity,
            };
            let entity = new LootSchema(this._owner._state, data);
            this._owner._state.entities.set(sessionId, entity);
        });
    }
}
