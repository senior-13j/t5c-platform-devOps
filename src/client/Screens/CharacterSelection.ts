import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { Image } from "@babylonjs/gui/2D/controls/image";
import { ScrollViewer } from "@babylonjs/gui/2D/controls/scrollViewers/scrollViewer";

import State from "./Screens";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { Engine } from "@babylonjs/core/Engines/engine";
import { GameController } from "../Controllers/GameController";

export class CharacterSelectionScene {
    public _game: GameController;
    public _scene: Scene;
    public _engine: Engine;
    private _ui: AdvancedDynamicTexture;
    public _button: Button;
    private selectionPanel: Rectangle;
    private leftColumnRect: Rectangle;
    private rightColumnRect;
    private characterPanel: StackPanel;
    private scrollViewerBloc: ScrollViewer;

    private charactersUI: Rectangle[] = [];
    private selectedCharacter;

    public sceneRendered = false;

    private isCompact(): boolean {
        return this._game?.controlMode === "touch" || window.innerWidth < 700;
    }

    public async createScene(game) {
        this._game = game;
        this._engine = game.engine;

        // create scene
        let scene = new Scene(this._engine);

        // set color
        scene.clearColor = new Color4(0.035, 0.055, 0.05, 1);

        //creates and positions a free camera
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), scene);
        camera.setTarget(Vector3.Zero()); //targets the camera to scene origin

        // set up ui
        const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        this._ui = guiMenu;

        // load scene
        this._scene = scene;
        await this._scene.whenReadyAsync();

        // if no user logged in, force a auto login
        // to be remove later or
        if (!this._game.isLoggedIn()) {
            await this._game.forceLogin();
        }

        // check if user token is valid
        let user = await this._game.isValidLogin();
        if (!user) {
            // if token not valid, send back to login screen
            this._game.setScene(State.LOGIN);
        }

        this.generateleftPanel();
        //this.generateRightPanel();

        if (user.characters.length > 0) {
            let index = user.characters.length - 1;
            this.selectCharacter(index, user.characters[index]);
        }

        // hide loading gui
        this._game.engine.hideLoadingUI();
    }

    generateleftPanel() {
        const compact = this.isCompact();

        // left columm
        const leftColumnRect = new Rectangle("columnLeft");
        leftColumnRect.top = 0;
        leftColumnRect.left = 0;
        leftColumnRect.width = compact ? 0.92 : "400px";
        leftColumnRect.height = compact ? 0.96 : Math.min(720, window.innerHeight * 0.9) + "px";
        leftColumnRect.background = "#0d1519";
        leftColumnRect.color = "#61746a";
        leftColumnRect.cornerRadius = 6;
        leftColumnRect.thickness = 1;
        leftColumnRect.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        leftColumnRect.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this._ui.addControl(leftColumnRect);
        this.selectionPanel = leftColumnRect;

        const leftColumnRectPad = new Rectangle("leftColumnRectPad");
        leftColumnRectPad.top = 0;
        leftColumnRectPad.width = compact ? 0.92 : 0.9;
        leftColumnRectPad.height = 1;
        leftColumnRectPad.thickness = 0;
        leftColumnRectPad.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        leftColumnRectPad.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        leftColumnRect.addControl(leftColumnRectPad);
        this.leftColumnRect = leftColumnRectPad;

        // welcome text
        const welcomeText = new TextBlock("infotext", this._game.t("character.choose"));
        welcomeText.width = 1;
        welcomeText.height = "40px";
        welcomeText.color = "white";
        welcomeText.top = "12px";
        welcomeText.fontSize = compact ? "19px" : "24px";
        welcomeText.fontWeight = "bold";
        welcomeText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        welcomeText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        leftColumnRectPad.addControl(welcomeText);

        const accountText = new TextBlock(
            "accountText",
            this._game.t("character.signedIn", { name: this._game.currentUser.username })
        );
        accountText.width = 1;
        accountText.height = "24px";
        accountText.color = "#b7c8c0";
        accountText.top = "50px";
        accountText.fontSize = compact ? "12px" : "13px";
        accountText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        accountText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        leftColumnRectPad.addControl(accountText);

        // BOTTOM ACTIONS
        const leftColumnBottomActions = new Rectangle("leftColumnBottomActions");
        leftColumnBottomActions.top = "-10px";
        leftColumnBottomActions.width = 1;
        leftColumnBottomActions.height = compact ? "92px" : "82px";
        leftColumnBottomActions.thickness = 0;
        leftColumnBottomActions.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        leftColumnBottomActions.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        leftColumnRectPad.addControl(leftColumnBottomActions);

        // logout btn
        const logoutBtn = Button.CreateSimpleButton("logoutBtn", this._game.t("character.signOut"));
        logoutBtn.top = "0px";
        logoutBtn.width = 1;
        logoutBtn.height = compact ? "36px" : "32px";
        logoutBtn.color = "white";
        logoutBtn.background = "#26323a";
        logoutBtn.thickness = 1;
        logoutBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        logoutBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        leftColumnBottomActions.addControl(logoutBtn);
        logoutBtn.onPointerDownObservable.add(() => {
            this._game.logout();
        });

        const characterEditorBtn = Button.CreateSimpleButton(
            "characterEditorBtn",
            this._game.t("character.createAdventurer")
        );
        characterEditorBtn.top = compact ? "-46px" : "-40px";
        characterEditorBtn.width = 1;
        characterEditorBtn.height = compact ? "36px" : "32px";
        characterEditorBtn.color = "white";
        characterEditorBtn.background = "#d38b16";
        characterEditorBtn.thickness = 1;
        characterEditorBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        characterEditorBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        leftColumnBottomActions.addControl(characterEditorBtn);

        characterEditorBtn.onPointerDownObservable.add(() => {
            this._game.setScene(State.CHARACTER_EDITOR);
        });

        this.generateCharacters();
    }

    generateCharacters() {
        const compact = this.isCompact();

        // add scrollable container
        var scrollViewerBloc = new ScrollViewer("chat-scroll-viewer");
        scrollViewerBloc.width = 1;
        scrollViewerBloc.height = compact ? 0.7 : 0.72;
        scrollViewerBloc.left = "0px";
        scrollViewerBloc.top = "82px";
        scrollViewerBloc.thickness = 1;
        scrollViewerBloc.color = "#35443d";
        scrollViewerBloc.background = "#111a1f";
        scrollViewerBloc.barSize = compact ? 8 : 10;
        scrollViewerBloc.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        scrollViewerBloc.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.leftColumnRect.addControl(scrollViewerBloc);
        this.scrollViewerBloc = scrollViewerBloc;

        const rightStackPanel = new StackPanel("rightStackPanel");
        rightStackPanel.left = 0;
        rightStackPanel.top = 0;
        rightStackPanel.width = 1;
        rightStackPanel.height = 1;
        rightStackPanel.spacing = 5;
        rightStackPanel.adaptHeightToChildren = true;
        rightStackPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        rightStackPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        rightStackPanel.setPaddingInPixels(5, 5, 5, 5);
        rightStackPanel.isVertical = true;
        scrollViewerBloc.addControl(rightStackPanel);
        this.characterPanel = rightStackPanel;

        let user = this._game.currentUser;
        let bgColor = "#1c272d";

        if (user.characters.length > 0) {
            let i = 0;
            user.characters.forEach((char, k) => {
                let race = this._game.getGameData("race", char.race);

                const characterBloc = new Rectangle("characterBloc" + char.id);
                characterBloc.width = 1;
                characterBloc.height = compact ? "106px" : "104px";
                characterBloc.background = bgColor;
                characterBloc.color = "#3e4d46";
                characterBloc.cornerRadius = 4;
                characterBloc.thickness = 1;
                characterBloc.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
                characterBloc.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
                rightStackPanel.addControl(characterBloc);

                this.charactersUI.push(characterBloc);

                if (this.selectedCharacter && this.selectedCharacter.id === char.id) {
                    characterBloc.background = "#145d3b";
                }

                var img = new Image("itemImage_" + char.id, "./images/portrait/" + race.icon + ".png");
                img.width = compact ? "46px" : "48px";
                img.height = compact ? "46px" : "48px";
                img.left = compact ? "14px" : "18px";
                img.top = "16px";
                img.stretch = Image.STRETCH_FILL;
                img.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
                img.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
                characterBloc.addControl(img);

                const characterName = new TextBlock("characterName", char.name);
                characterName.width = 0.64;
                characterName.height = "30px";
                characterName.color = "white";
                characterName.left = compact ? "70px" : "82px";
                characterName.top = "12px";
                characterName.fontWeight = "bold";
                characterName.fontSize = compact ? "16px" : "18px";
                characterName.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
                characterName.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
                characterName.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
                characterBloc.addControl(characterName);

                const characterDetails = new TextBlock(
                    "characterDetails",
                    this._game.t("character.level", { level: char.level })
                );
                characterDetails.width = 0.6;
                characterDetails.height = "40px";
                characterDetails.color = "#c2d0ca";
                characterDetails.left = compact ? "70px" : "82px";
                characterDetails.top = "38px";
                characterDetails.fontSize = "12px";
                characterDetails.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
                characterDetails.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
                characterDetails.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
                characterBloc.addControl(characterDetails);

                const createBtn = Button.CreateSimpleButton("characterBtn-" + char.id, this._game.t("character.play"));
                createBtn.left = compact ? "70px" : "82px";
                createBtn.top = compact ? "66px" : "64px";
                createBtn.width = compact ? "112px" : "120px";
                createBtn.height = compact ? "32px" : "30px";
                createBtn.background = "#d38b16";
                createBtn.color = "white";
                createBtn.thickness = 1;
                createBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
                createBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
                characterBloc.addControl(createBtn);

                createBtn.onPointerDownObservable.add(() => {
                    this._game.setCharacter(char);
                    this._game.setScene(State.GAME);
                });

                i++;
            });
        }
    }

    selectCharacter(index, char) {
        this.selectedCharacter = char;

        // reset selection
        this.charactersUI.forEach((element) => {
            element.background = "#1c272d";
        });

        // set current selected
        this.charactersUI[index].background = "#145d3b";
    }

    public resize() {
        if (!this.selectionPanel || !this.leftColumnRect) {
            return;
        }

        const compact = this.isCompact();
        this.selectionPanel.width = compact ? 0.92 : "400px";
        this.selectionPanel.height = compact ? 0.96 : Math.min(720, window.innerHeight * 0.9) + "px";
        this.leftColumnRect.width = compact ? 0.92 : 0.9;
        this.scrollViewerBloc.height = compact ? 0.7 : 0.72;
    }
}
