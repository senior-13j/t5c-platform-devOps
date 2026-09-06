if (process.env.NODE_ENV !== "production") {
    import("@babylonjs/core/Debug/debugLayer");
    import("@babylonjs/inspector");
}

// ES6 IMPORTS
// if there are cases where es6 dependencies could be causing issues just try and load the whole babylon core, and
// that fixes it, then it is a dependencies issue, check this link out for answers.
// bjs post: https://forum.babylonjs.com/t/pickedmesh-is-null-in-onpointerobservable-after-update-to-6-25-0/45076/7
// bjs docs: https://doc.babylonjs.com/setup/frameworkPackages/es6Support#faq
import "@babylonjs/core/Culling/ray";
import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_pbrSpecularGlossiness";
import "@babylonjs/loaders/glTF/2.0/Extensions/KHR_draco_mesh_compression";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/outlineRenderer";
import "@babylonjs/core/Audio/audioSceneComponent";

import { DracoCompression } from "@babylonjs/core/Meshes/Compression/dracoCompression";
import { assetUrl, isLocal } from "./Utils";

DracoCompression.Configuration = {
    decoder: {
        wasmUrl: assetUrl("lib/draco_wasm_wrapper_gltf.js"),
        wasmBinaryUrl: assetUrl("lib/draco_decoder_gltf.wasm"),
        fallbackUrl: assetUrl("lib/draco_decoder_gltf.js"),
    },
};

import { Engine } from "@babylonjs/core/Engines/engine";
import State from "./Screens/Screens";
import { LoginScene } from "./Screens/LoginScene";
import { CharacterSelectionScene } from "./Screens/CharacterSelection";
import { CharacterEditor } from "./Screens/CharacterEditor";
import { GameScene } from "./Screens/GameScene";
import { DebugScene } from "./Screens/DebugScene";
import { Config } from "../shared/Config";
import { Loading } from "./Controllers/Loading";
import { GameController } from "./Controllers/GameController";
import { PreferencesController } from "./Controllers/PreferencesController";

// App class is our entire game application
class App {
    // babylon
    public canvas: HTMLCanvasElement;
    public engine: Engine;
    public config: Config;
    public game: GameController;
    public preferences: PreferencesController;
    private loadingScreen: Loading;

    constructor() {
        // create canvas
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

        // set config
        this.config = new Config();
        this.preferences = new PreferencesController();
        this.loadingScreen = new Loading(this.preferences);

        // initialize babylon scene and engine
        this._init().catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            if (/webgl/i.test(message)) {
                console.warn("[GAME] WebGL is unavailable", error);
            } else {
                console.error("[GAME] startup failed", error);
            }
            this.loadingScreen.showFatalError(error);
        });
    }

    private async _init(): Promise<void> {
        await this.preferences.requestEntrySelection();

        if (!Engine.isSupported()) {
            throw new Error("WebGL not supported");
        }

        const compactViewport = this.isCompactViewport();

        // create engine
        this.engine = new Engine(this.canvas, !compactViewport, {
            adaptToDeviceRatio: false,
            antialias: true,
        });

        this.updateRenderingScale();

        // loading
        this.engine.loadingScreen = this.loadingScreen;
        this.loadingScreen.displayLoadingUI();

        // preload game data
        this.game = new GameController(this);
        this.loadingScreen.setDetails(this.preferences.t("loading.worldData"));
        await this.game.initializeGameData();

        // set default scene
        let defaultScene = isLocal() ? State.GAME : State.LOGIN;
        this.game.setScene(defaultScene);

        // main render loop & state machine
        await this._render();
    }

    private async _render(): Promise<void> {
        // render loop
        this.engine.runRenderLoop(() => {
            // monitor state
            this.game.state = this.checkForSceneChange();

            switch (this.game.state) {
                ///////////////////////////////////////
                // LOGIN SCENE
                case State.LOGIN:
                    this.clearScene();
                    this.game.currentScene = new LoginScene();
                    this.createScene();
                    break;

                ///////////////////////////////////////
                // CHARACTER SELECTION SCENE
                case State.CHARACTER_SELECTION:
                    this.clearScene();
                    this.game.currentScene = new CharacterSelectionScene();
                    this.createScene();
                    break;

                ///////////////////////////////////////
                // CHARACTER SELECTION SCENE
                case State.CHARACTER_EDITOR:
                    this.clearScene();
                    this.game.currentScene = new CharacterEditor();
                    this.createScene();
                    break;

                ///////////////////////////////////////
                // GAME
                case State.GAME:
                    this.clearScene();
                    this.game.currentScene = new GameScene();
                    this.createScene();
                    break;

                ///////////////////////////////////////
                // DEBUG
                case State.DEBUG_SCENE:
                    this.clearScene();
                    this.game.currentScene = new DebugScene();
                    this.createScene();
                    break;

                default:
                    break;
            }

            // render when scene is ready
            this._process();
        });

        //for development: make inspector visible/invisible
        if (isLocal()) {
            window.addEventListener("keydown", (ev) => {
                //Shift+Ctrl+Alt+I
                if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
                    if (this.game.scene.debugLayer.isVisible()) {
                        this.game.scene.debugLayer.hide();
                    } else {
                        this.game.scene.debugLayer.show();
                    }
                }
            });
        }

        // Resize the engine first, then reflow Babylon GUI on subsequent frames.
        // AdvancedDynamicTexture keeps its previous dimensions until the engine
        // has processed a frame, which otherwise briefly clips panels after a
        // phone/tablet orientation change.
        let pendingResizeFrame = 0;
        window.addEventListener("resize", () => {
            this.updateRenderingScale();
            this.engine.resize();

            window.cancelAnimationFrame(pendingResizeFrame);
            pendingResizeFrame = window.requestAnimationFrame(() => {
                this.engine.resize();
                this.game.currentScene?.resize?.();
                pendingResizeFrame = window.requestAnimationFrame(() => this.game.currentScene?.resize?.());
            });
        });
    }

    private createScene() {
        const sceneController = this.game.currentScene;

        try {
            const sceneReady = sceneController.createScene(this.game);
            this.game.scene = sceneController._scene;
            this.game.state = State.NULL;

            Promise.resolve(sceneReady).catch((error) => {
                if (this.game.currentScene === sceneController) {
                    console.error("[GAME] scene failed", error);
                    this.loadingScreen.showFatalError(error);
                }
            });
        } catch (error) {
            console.error("[GAME] scene failed", error);
            this.loadingScreen.showFatalError(error);
        }
    }

    private checkForSceneChange() {
        let currentScene = this.game.nextScene;
        if (this.game.nextScene !== State.NULL) {
            this.game.nextScene = State.NULL;
            return currentScene;
        }
    }

    private async _process(): Promise<void> {
        // make sure scene and camera is initialized
        if (this.game.scene && this.game.scene.activeCamera) {
            // render scene
            //this.game.currentScene.engineUpdate();
            this.game.scene.render();
        }
    }

    private clearScene() {
        if (this.game.scene) {
            const loginOverlay = document.getElementById("loginOverlay");
            if (loginOverlay) {
                loginOverlay.hidden = true;
            }
            document.getElementById("touchControls")?.setAttribute("hidden", "");
            document.getElementById("quickGuideButton")?.setAttribute("hidden", "");
            document.getElementById("onboardingOverlay")?.setAttribute("hidden", "");
            document.body.classList.remove("touch-ui-obscured", "guide-open");
            this.game.engine.displayLoadingUI();
            this.game.scene.detachControl();
            this.game.scene.dispose();
            this.game.currentScene = null;
        }
    }

    private isCompactViewport(): boolean {
        return this.preferences.controlMode === "touch" || window.innerWidth < 700 || window.matchMedia("(pointer: coarse)").matches;
    }

    private updateRenderingScale() {
        if (!this.engine) {
            return;
        }

        this.engine.setHardwareScalingLevel(this.isCompactViewport() ? 1.2 : 1);
    }
}

const app = new App();
if (process.env.NODE_ENV !== "production") {
    (window as any).__ARKADII_QUEST_APP__ = app;
}
