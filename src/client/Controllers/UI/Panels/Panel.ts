import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { Tooltip } from "../Tooltip";
import { applyTheme } from "../Theme";
import { Scene } from "@babylonjs/core/scene";
import { GameController } from "../../GameController";
import { UserInterface } from "../../UserInterface";
import { Room } from "colyseus.js";
import { TrainerDialog } from "./Dialog/TrainerDialog";
import { VendorDialog } from "./Dialog/VendorDialog";
import { QuestDialog } from "./Dialog/QuestDialog";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Player } from "../../../Entities/Player";

export class Panel {
    public _UI: UserInterface;
    public _game: GameController;
    public _engine: Engine;
    public _playerUI;
    public _room: Room;
    private _UITooltip: Tooltip;
    public _scene: Scene;
    public _currentPlayer;
    public _loadedAssets;
    public _options;

    // panel stuff
    public _panel;
    public _panelTitle;
    public _panelContent;
    private _panelHeader: Rectangle;
    private _panelClose: Button;

    // drag stuff
    public _isPointerDown: boolean = false;
    public _pointerDownPosition;
    public _isDragging: boolean = false;

    //
    public trainer: TrainerDialog;
    public vendor: VendorDialog;
    public quest: QuestDialog;

    constructor(_UI, _currentPlayer: Player, options) {
        //
        this._UI = _UI;
        this._game = _UI._game;
        this._playerUI = _UI._playerUI;
        this._UITooltip = _UI._UITooltip;
        this._room = _UI._room;
        this._scene = _UI._scene;
        this._currentPlayer = _currentPlayer;
        this._loadedAssets = _UI._loadedAssets;
        this._engine = _UI._engine;

        // set defaults
        this._options = {
            name: options.name ?? "Panel Name",
            horizontal_position: options.horizontal_position ?? Control.HORIZONTAL_ALIGNMENT_CENTER,
            vertical_position: options.vertical_position ?? Control.VERTICAL_ALIGNMENT_CENTER,
            width: options.width ?? 1,
            height: options.height ?? 1,
            top: options.top ?? "0px",
            left: options.left ?? "0px",
            stayOpen: options.stayOpen ?? false,
        };

        //
        this._create(this._options);
        this.resize();

        // some ui must be constantly refreshed as things change
        this._scene.registerBeforeRender(() => {
            // refresh
            this.update();
        });
    }

    // create panel
    private _create(options) {
        let panel: Rectangle = new Rectangle("panel-" + options.name);
        panel.top = options.top;
        panel.left = options.left;
        panel.width = options.width;
        panel.height = options.height;
        panel.horizontalAlignment = options.horizontal_position;
        panel.verticalAlignment = options.vertical_position;
        panel.thickness = options.thickness;
        panel.cornerRadius = options.cornerRadius;
        panel.background = options.background;
        panel.color = options.color;
        panel.isPointerBlocker = true;
        panel.isVisible = false;
        panel.zIndex = 10;
        applyTheme(panel);
        this._playerUI.addControl(panel);

        this._panel = panel;

        this._createHeader();
        this._createContentPanel();
    }

    // create panel header
    private _createContentPanel() {
        const panelContent: Rectangle = new Rectangle("panelContent");
        panelContent.top = "30px";
        panelContent.left = 0;
        panelContent.width = 1;
        panelContent.height = 0.91;
        panelContent.thickness = 0;
        panelContent.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        panelContent.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this._panel.addControl(panelContent);
        this._panelContent = panelContent;
    }

    // create panel header
    private _createHeader() {
        const panelHeader: Rectangle = new Rectangle("panelHeader");
        panelHeader.top = 0;
        panelHeader.left = 0;
        panelHeader.width = 1;
        panelHeader.height = "30px";
        panelHeader.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        panelHeader.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        panelHeader.color = "rgba(0,0,0,1)";
        panelHeader.thickness = 0;
        panelHeader.fontFamily = "Georgia, Times New Roman, serif";
        this._panel.addControl(panelHeader);
        this._panelHeader = panelHeader;

        // header title
        var panelTitle = new TextBlock("panelTitle");
        panelTitle.text = this._options.name;
        panelTitle.color = "#FFFFFF";
        panelTitle.top = "0px";
        panelTitle.left = "5px";
        panelTitle.fontSize = "22px";
        panelTitle.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        panelTitle.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        panelTitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        panelTitle.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        panelHeader.addControl(panelTitle);
        this._panelTitle = panelTitle;

        // close button
        const mainPanelClose = Button.CreateSimpleButton("mainPanelClose", "X");
        mainPanelClose.width = "20px";
        mainPanelClose.height = "20px";
        mainPanelClose.color = "white";
        mainPanelClose.top = "5px";
        mainPanelClose.left = "-5px";
        mainPanelClose.thickness = 1;
        mainPanelClose.background = "black";
        mainPanelClose.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        mainPanelClose.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        panelHeader.addControl(mainPanelClose);
        this._panelClose = mainPanelClose;
        mainPanelClose.onPointerDownObservable.add(() => {
            this.close();
        });

        // drag and drop events
        panelHeader.onPointerDownObservable.add((e) => {
            if (this._game.controlMode === "touch") {
                return;
            }
            this._UI.startDragging(this._panel);
            this._panel.isPointerBlocker = false;
        });
        panelHeader.onPointerUpObservable.add((e) => {
            if (this._game.controlMode === "touch") {
                return;
            }
            this._UI.stopDragging();
        });
    }

    // open panel
    public open(): void {
        // Babylon GUI measures controls on a render frame. Re-apply the current
        // viewport before showing a panel so an orientation change cannot flash
        // the previous portrait/landscape dimensions.
        this.resize();
        const visible = this._panel.isVisible;

        if (this._game.controlMode === "touch" && !visible) {
            this._UI.hidePanelsExcept(this);
        }

        // close all panels
        if (!this._options.stayOpen) {
            this._UI.panelAbilities._panel.isVisible = false;
            this._UI.panelCharacter._panel.isVisible = false;
            this._UI.panelHelp._panel.isVisible = false;
            this._UI.panelQuests._panel.isVisible = false;
        }

        // if already open, close panel
        if (visible) {
            this._panel.isVisible = false;
            this._game.gamescene._sound.play("SOUND_dialog_close");
        } else {
            this._panel.isVisible = true;
            this._game.gamescene._sound.play("SOUND_dialog_open");
        }
        this._UI.syncTouchOverlayState();
    }

    // close panel
    public close() {
        this._panel.isVisible = false;

        if (this.vendor) {
            this.vendor.sellingModeOff();
        }

        this._game.gamescene._sound.play("SOUND_dialog_close");
        this._UI.syncTouchOverlayState();
    }

    public isOpen(): boolean {
        return this._panel.isVisible;
    }

    public resize() {
        const compact = this._game.controlMode === "touch" || window.innerWidth < 700;
        if (!compact) {
            this._panel.width = this._options.width;
            this._panel.height = this._options.height;
            this._panel.top = this._options.top;
            this._panel.left = this._options.left;
            this._panel.horizontalAlignment = this._options.horizontal_position;
            this._panel.verticalAlignment = this._options.vertical_position;
            this._panelHeader.height = "30px";
            this._panelTitle.fontSize = "22px";
            this._panelClose.width = "20px";
            this._panelClose.height = "20px";
            this._panelClose.top = "5px";
            this._panelContent.top = "30px";
            this._panelContent.height = 0.91;
            return;
        }

        const viewport = this._UI.getGuiViewport();
        const configuredWidth = this.getPixelValue(this._options.width, viewport.width);
        const configuredHeight = this.getPixelValue(this._options.height, viewport.height);
        const availableWidth = Math.max(180, viewport.width - 24 * viewport.scaleX);
        const availableHeight = Math.max(180, viewport.height - 24 * viewport.scaleY);
        const panelHeight = Math.min(configuredHeight, availableHeight);
        this._panel.width = Math.min(configuredWidth, availableWidth) + "px";
        this._panel.height = panelHeight + "px";
        this._panel.top = "0px";
        this._panel.left = "0px";
        this._panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this._panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this._panelHeader.height = "40px";
        this._panelTitle.fontSize = "18px";
        this._panelTitle.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this._panelClose.width = 44 * viewport.scaleX + "px";
        this._panelClose.height = 44 * viewport.scaleY + "px";
        this._panelClose.top = "3px";
        this._panelContent.top = "40px";
        this._panelContent.height = Math.max(1, panelHeight - 40) + "px";
    }

    // update panel
    public update() {}

    // refresh panel
    public refresh() {}

    private getPixelValue(value, fallback: number): number {
        if (typeof value === "number") {
            return value <= 1 ? fallback * value : value;
        }

        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
}
