import State from "../Screens/Screens";
import axios from "axios";
import { apiUrl } from "../Utils/index";
import { Network } from "./Network";
import { AssetsController } from "./AssetsController";
import { VatController } from "./VatController";
import { AssetContainer } from "@babylonjs/core/assetContainer";
import { Room } from "colyseus.js";
import { Config } from "../../shared/Config";
import { ServerMsg } from "../../shared/types";
import { GameScene } from "../Screens/GameScene";
import { PreferencesController } from "./PreferencesController";
import {
    ControlMode,
    Locale,
    TranslationKey,
    TranslationParams,
    localizeGameData,
    localizeServerMessage,
} from "../i18n";

export class GameController {
    // core
    public engine;
    public scene;
    public client: Network;
    public config: Config;
    public preferences: PreferencesController;

    // scene management
    public state: number = 0;
    public currentScene;
    public nextScene;
    public gamescene: GameScene;

    // all user data
    public currentSessionID: string;
    public currentChat: Room;
    public currentRoom: Room;

    // all user data
    public currentLocation;
    public currentLocationKey;
    public _currentUser;
    public _currentCharacter;
    public selectedEntity;
    public currentMs: number;
    public deltaCamY: number = 2.7; // offset for camera to prevent camera moving when the player rotates
    public latestError: string;
    public isMobile: boolean = false;
    public currentChats = [];

    // all preloaded assets
    public _assetsCtrl: AssetsController;
    public _loadedAssets: AssetContainer[] = [];
    public _vatController: VatController;
    public instances = new Map();
    public materials = new Map();

    //
    public sellingMode: boolean = false;

    // all game data
    private _gameData = {
        items: [],
        abilities: [],
        locations: [],
        races: [],
        quests: [],
        help: [],
    };

    constructor(app) {
        // core
        this.engine = app.engine;
        this.config = app.config;
        this.scene = app.scene;
        this.preferences = app.preferences;

        // create colyseus client
        this.client = new Network(app.config.port);

        // Prefer capabilities and viewport size over user-agent-only detection.
        this.isMobile =
            this.controlMode === "touch" ||
            window.innerWidth < 700 ||
            window.matchMedia("(pointer: coarse)").matches ||
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    public get locale(): Locale {
        return this.preferences.locale;
    }

    public get controlMode(): ControlMode {
        return this.preferences.controlMode;
    }

    public t(key: TranslationKey, params: TranslationParams = {}): string {
        return this.preferences.t(key, params);
    }

    public translateServerMessage(message: string): string {
        return localizeServerMessage(message, this.locale);
    }

    setErrorCode(message: string): void {
        console.error(message);
        this.latestError = message;
    }

    /////////////////////////////////////////
    //////////// SCENE MANAGEMENT ///////////
    /////////////////////////////////////////

    public setScene(newState: State) {
        this.nextScene = newState;
    }

    /////////////////////////////////////////
    //////////// GAME DATA /////////////////
    /////////////////////////////////////////

    async initializeGameData() {
        const result = await axios.request({
            method: "GET",
            url: apiUrl(this.config.port) + "/load_game_data",
        });
        this._gameData = localizeGameData(result.data.data, this.locale, this.controlMode);
        console.log("[GAME] loaded game data", this._gameData);
    }

    public getGameData(type, key) {
        let returnData;
        switch (type) {
            case "ability":
                returnData = this._gameData.abilities[key] ?? false;
                break;
            case "race":
                returnData = this._gameData.races[key] ?? false;
                break;
            case "location":
                returnData = this._gameData.locations[key] ?? false;
                break;
            case "item":
                returnData = this._gameData.items[key] ?? false;
                break;
            case "quest":
                returnData = this._gameData.quests[key] ?? false;
                break;
            case "":
                returnData = false;
                break;
        }
        return returnData;
    }

    public loadGameData(type) {
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
            case "help":
                returnData = this._gameData.help ?? false;
                break;
            case "":
                returnData = false;
                break;
        }

        return returnData;
    }

    /////////////////////////////////////////
    //////////// ASSETS DATA /////////////////
    /////////////////////////////////////////

    async fetchAsset(key) {
        if (this._loadedAssets[key]) {
            return this._loadedAssets[key];
        }
    }

    async initializeAssetController(shadow = null) {
        this._loadedAssets = [];
        this._assetsCtrl = new AssetsController(this, shadow);
    }

    /////////////////////////////////////////
    //////////// AUTH DATA /////////////////
    /////////////////////////////////////////

    public get currentUser() {
        return this._currentUser;
    }

    public get currentCharacter() {
        return this._currentCharacter;
    }

    // check login details
    public async forceLogin() {
        const req = await axios.request({
            method: "POST",
            url: apiUrl(this.config.port) + "/returnRandomUser",
        });
        let character = req.data.user;
        if (character) {
            // set user
            this.setUser({
                id: character.user_id,
                username: character.username,
                token: character.token,
            });
            //set character
            this.setCharacter(character);
        }
    }

    public isLoggedIn() {
        return this._currentUser ? true : false;
    }

    // check login details
    public async isValidLogin() {
        let user = this.currentUser;

        // check user exists else send back to login
        const req = await axios.request({
            method: "POST",
            data: { token: user.token },
            url: apiUrl(this.config.port) + "/check",
        });

        // check req status
        if (req.status === 200) {
            let user = req.data.user;
            this.setUser(user);
            return user;
        } else {
            // something went wrong
            console.error("Something went wrong.");
        }
    }

    // login as this character
    public async login(username, password) {
        // make sure both the username and password is entered.
        if (!username || !password) {
            console.error("Please enter both the username and the password.");
            return false;
        }

        // send login data
        try {
            const req = await axios.request({
                method: "POST",
                data: {
                    username: username,
                    password: password,
                },
                url: apiUrl(this.config.port) + "/login",
            });

            if (req.status === 200) {
                this._currentUser = req.data.user;
                localStorage.setItem("t5c_token", req.data.user.token);
                return true;
            }
        } catch (error) {
            this.setErrorCode(this.t("login.invalid"));
        }

        return false;
    }

    // set user
    public setUser(user) {
        this._currentUser = user;
    }

    // set character
    public setCharacter(character) {
        this._currentCharacter = character;
        this.currentLocationKey = character.location;
        this.currentLocation = this.getGameData("location", character.location);
    }

    // set character
    public setLocation(location) {
        this.currentLocationKey = location;
        this.currentLocation = this.getGameData("location", location);
        this._currentCharacter.location = location;
    }

    // logout
    public logout() {
        this._currentUser = null;
        this._currentCharacter = null;
        localStorage.removeItem("t5c_token");
        this.setScene(State.LOGIN);
    }

    public sendMessage(type: ServerMsg, data: {} = {}) {
        let message = {
            date: new Date().getTime(),
        };
        if (Object.keys(data).length) {
            for (const [key, value] of Object.entries(data)) {
                message[key] = value;
            }
        }
        this.currentRoom.send(type, message);
    }
}
