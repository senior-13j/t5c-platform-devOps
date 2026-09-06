import type { PlayerSchema } from "./../../server/rooms/schema";
import { roundTo } from "../Utils";
import { ServerMsg } from "../types";

export const MAX_EXPERIENCE = 4_294_967_295;

// level progression
const LEVEL_EXPERIENCE = [
    0, // Level 1
    1000, // Level 2
    5713, // Level 3
    15900, // Level 4
    32960, // Level 5
    58137, // Level 6
    92590, // Level 7
    137420, // Level 8
    193690, // Level 9
    262450, // Level 10
    344700, // Level 11
    441442, // Level 12
    553700, // Level 13
    682500, // Level 14
    828700, // Level 15
    993480, // Level 16
    1177700, // Level 17
    1382400, // Level 18
    1608300, // Level 19
    1857000, // Level 20
];

export class Leveling {
    /**
     * return total xp required for level
     * @param level
     * @returns level number
     */
    public static getTotalLevelXp(level: number): number {
        if (!Number.isSafeInteger(level) || level < 0) {
            return 0;
        }
        return LEVEL_EXPERIENCE[Math.min(level, LEVEL_EXPERIENCE.length - 1)];
    }

    /**
     * convert experience to level (eg: 500 xp would return level 1)
     * @param experience
     * @returns level number
     */
    public static convertXpToLevel(experience: number): number {
        if (!Number.isFinite(experience) || experience < 0) {
            return 1;
        }
        let level = 1;
        LEVEL_EXPERIENCE.forEach((v, i) => {
            if (experience >= v) {
                level = i + 1;
            }
        });
        return level;
    }

    /**
     * check if player has levelled up
     * @param currentLevel
     * @param currentExperience
     * @param amount
     * @returns boolean (true if player has levelled up, false otherwise)
     */
    public static doesPlayerlevelUp(currentLevel: number, currentExperience: number, amount: number) {
        if (
            !Number.isSafeInteger(currentLevel) ||
            currentLevel < 1 ||
            !Number.isFinite(currentExperience) ||
            currentExperience < 0 ||
            !Number.isFinite(amount) ||
            amount < 0
        ) {
            return false;
        }
        let newExperience = currentExperience + amount;
        let nextExpCap = LEVEL_EXPERIENCE[currentLevel];
        if (nextExpCap !== undefined && newExperience >= nextExpCap) {
            return true;
        }
        return false;
    }

    /**
     * returns current level progress as a percentage
     * @param experience
     * @returns percentage
     */
    public static getLevelProgress(experience: number) {
        if (!Number.isFinite(experience) || experience < 0) {
            return 0;
        }
        let currentLevel = this.convertXpToLevel(experience);
        if (currentLevel >= LEVEL_EXPERIENCE.length) {
            return 100;
        }
        let xpEarnedThisLevel = experience - LEVEL_EXPERIENCE[currentLevel - 1];
        let xpThisLevel = LEVEL_EXPERIENCE[currentLevel] - LEVEL_EXPERIENCE[currentLevel - 1];
        return roundTo((xpEarnedThisLevel / xpThisLevel) * 100, 0);
    }

    public static addExperience(owner: PlayerSchema, amount): boolean {
        const currentExperience = Number(owner?.player_data?.experience);
        const reward = Number(amount);
        if (
            !owner ||
            !Number.isSafeInteger(currentExperience) ||
            currentExperience < 0 ||
            currentExperience > MAX_EXPERIENCE ||
            !Number.isSafeInteger(reward) ||
            reward < 0
        ) {
            return false;
        }

        // add experience to player
        let currentLevel = owner.level;
        owner.player_data.experience = Math.min(MAX_EXPERIENCE, currentExperience + reward);
        owner.level = Leveling.convertXpToLevel(owner.player_data.experience);

        // has the level changed
        if (owner.level > currentLevel) {
            let levelDifference = owner.level - currentLevel;
            let levelUpChange = 50 * levelDifference;

            owner.statsCTRL.updateBaseStats("maxMana", levelUpChange);
            owner.statsCTRL.updateBaseStats("maxHealth", levelUpChange);
            owner.health = owner.statsCTRL.getStat("maxHealth");
            owner.mana = owner.statsCTRL.getStat("maxMana");
            owner.player_data.points += 5;

            // inform player
            let client = owner.getClient();
            client?.send(ServerMsg.SERVER_MESSAGE, {
                type: "event",
                message: "You've gained knowledge and are now level " + owner.level + ".",
                date: new Date(),
            });
        }
        return true;
    }
}
