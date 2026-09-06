import Logger from "../../utils/Logger";
import { Leveling } from "../../../shared/Class/Leveling";
import { randomNumberInRange } from "../../../shared/Utils";
import { GetLoot } from "../../../shared/Class/LootTable";
import { nanoid } from "nanoid";
import { LootSchema } from "../schema/LootSchema";
import { PlayerSchema } from "../schema";
import { ServerMsg } from "../../../shared/types";
import { calculateSaturatedGoldBalance, getRewardRange, parsePositiveQuantity } from "../gameplayRules";

export class dropCTRL {
    private _owner: PlayerSchema;
    private _client;

    constructor(owner, client) {
        this._owner = owner;
        this._client = client;
    }

    public addExperience(target) {
        const experienceRange = getRewardRange(target?.AI_SPAWN_INFO?.experienceGain ?? target?.experienceGain);
        if (!experienceRange) {
            return false;
        }
        const amount = Math.floor(randomNumberInRange(experienceRange.min, experienceRange.max));
        return Leveling.addExperience(this._owner, amount);
    }

    public addGold(target) {
        const goldRange = getRewardRange(target?.AI_SPAWN_INFO?.goldGain ?? target?.goldGain);
        if (!goldRange) {
            return false;
        }

        const rolledGold = Math.floor(randomNumberInRange(goldRange.min, goldRange.max));
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
            this._client?.send(ServerMsg.SERVER_MESSAGE, {
                type: "event",
                message: "You pick up " + awardedGold + " worth of gold.",
                date: new Date(),
            });
        }
        return true;
    }

    public dropItems(target) {
        let items = target?.AI_SPAWN_INFO?.drops ?? [];
        let loot = GetLoot(items);
        loot.forEach((drop) => {
            const quantity = parsePositiveQuantity(drop?.quantity);
            if (typeof drop?.id !== "string" || !this._owner._state.gameData.get("item", drop.id) || quantity === null) {
                return;
            }
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
                qty: quantity,
            };
            let entity = new LootSchema(this._owner._state, data);
            this._owner._state.addGroundLoot(entity);
        });
    }
}
