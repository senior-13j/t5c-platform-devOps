import axios from "axios";

import { Ability, Race, Item, Quest } from "../../../shared/types";
import { getOwnDataEntry } from "../../utils/getOwnDataEntry";

export class gameDataCTRL {
    private _gameData = {
        items: [],
        abilities: [],
        locations: [],
        races: [],
        quests: [],
    };
    private port = Number(process.env.APP_PORT) || 3000;

    constructor() {}

    async initialize() {
        const options = {
            method: "GET",
            url: `http://127.0.0.1:${this.port}/load_game_data`,
            params: { category: "all", count: "2" },
            headers: {
                "X-RapidAPI-Key": "your-rapid-key",
                "X-RapidAPI-Host": "famous-quotes4.p.rapidapi.com",
            },
        };
        const result = await axios.request(options);
        this._gameData = result.data.data;
    }

    public get(type, key) {
        let returnData;
        switch (type) {
            case "ability":
                returnData = getOwnDataEntry<Ability>(this._gameData.abilities, key);
                break;
            case "race":
                returnData = getOwnDataEntry<Race>(this._gameData.races, key);
                break;
            case "location":
                returnData = getOwnDataEntry(this._gameData.locations, key);
                break;
            case "item":
                returnData = getOwnDataEntry<Item>(this._gameData.items, key);
                break;
            case "quest":
                returnData = getOwnDataEntry<Quest>(this._gameData.quests, key);
                break;
            case "":
                returnData = false;
                break;
        }
        return returnData;
    }

    public load(type) {
        let returnData;
        switch (type) {
            case "abilities":
                returnData = this._gameData.abilities ?? false;
                break;
            case "races":
                returnData = this._gameData.races ?? false;
                break;
            case "locations":
                returnData = this._gameData.locations ?? false;
                break;
            case "items":
                returnData = this._gameData.items ?? false;
                break;
            case "quests":
                returnData = this._gameData.quests ?? false;
                break;
            case "":
                returnData = false;
                break;
        }

        return returnData;
    }
}
