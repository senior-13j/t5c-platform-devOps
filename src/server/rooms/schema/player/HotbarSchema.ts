import { Schema, type } from "@colyseus/schema";
import { GameData } from "../../../GameData";
import { ItemClass } from "../../../../shared/types";

export class HotbarSchema extends Schema {
    // networked player specific
    @type("string") public type: string = "";
    @type("string") public key: string = "";
    @type("uint8") public digit: number = 0;

    public class?: ItemClass;

    constructor(data: { digit: number | string; type: string; key: string }) {
        super();

        const digit = Number(data?.digit);
        if (!Number.isSafeInteger(digit) || digit < 0 || digit > 255) {
            throw new Error("Invalid hotbar digit.");
        }

        const hotbarType = data?.type;
        const key = data?.key;
        if ((hotbarType !== "ability" && hotbarType !== "item") || typeof key !== "string" || key.length === 0) {
            throw new Error("Invalid hotbar entry.");
        }

        const gameEntry = GameData.get(hotbarType, key);
        if (!gameEntry) {
            throw new Error(`Unknown ${hotbarType} hotbar entry: ${key}`);
        }

        // Hotbar's `type` is the entry kind ("ability" or "item"). Never copy
        // the whole game-data record here: abilities also have a numeric combat
        // `type`, which would corrupt this networked string field under Schema 5.
        this.type = hotbarType;
        this.key = key;
        this.digit = digit;
        if (hotbarType === "item") {
            this.class = gameEntry.class;
        }
    }
}
