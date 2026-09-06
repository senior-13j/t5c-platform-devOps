import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock, TextWrapping } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { Image } from "@babylonjs/gui/2D/controls/image";
import { Player } from "../../Entities/Player";
import { generatePanel, getBg, getPadding } from "./Theme";
import { GameController } from "../GameController";
import { ServerMsg } from "../../../shared/types";
import { Room } from "colyseus.js";
import { UserInterface } from "../UserInterface";

type HotbarLayout = {
    columns: number;
    contentHeight: number;
    gutter: number;
    iconSize: number;
    offset: number;
    width: number;
};

export class HotBar {
    private _playerUI;
    private _abilityUI;
    private _UI: UserInterface;
    private _room;
    private _game: GameController;
    private _loadedAssets;
    private _currentPlayer: Player;
    private _UITooltip;
    private _layoutKey = "";

    constructor(_UI: UserInterface, _currentPlayer) {
        this._playerUI = _UI._playerUI;
        this._currentPlayer = _currentPlayer;
        this._room = _UI._room;
        this._loadedAssets = _UI._loadedAssets;
        this._game = _UI._game;
        this._UI = _UI;

        // create ui
        this._createUI();

        // add ui events
        let entity = this._currentPlayer.entity;
        entity.player_data.hotbar.onAdd((item, sessionId) => {
            this._createUI();
            // todo: could be a performance issue here?
            // orion to keep an eye on this one
            item.onChange((item, sessionId) => {
                this._createUI();
            });
            item.onRemove((item, sessionId) => {
                this._createUI();
            });
        });
    }

    _createUI() {
        const layout = this.getLayout();
        this._layoutKey = this.getLayoutKey(layout);
        let abilityRect: Rectangle[] = [];

        if (this._abilityUI) {
            this._abilityUI.dispose();
        }

        const abilityMainPanel = generatePanel(
            "abilityPanel",
            layout.width + 10 + "px",
            layout.contentHeight + 10 + "px",
            layout.offset + "px",
            "0px"
        );
        abilityMainPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        abilityMainPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        abilityMainPanel.isPointerBlocker = true;
        this._playerUI.addControl(abilityMainPanel);

        const paddingPanel = new Rectangle("paddingPanel");
        paddingPanel.width = 1;
        paddingPanel.height = 1;
        paddingPanel.thickness = 0;
        paddingPanel.setPaddingInPixels(getPadding());
        abilityMainPanel.addControl(paddingPanel);
        this._abilityUI = abilityMainPanel;

        // add stack panel
        const abilityPanel = new Rectangle("abilityPanel");
        abilityPanel.top = "0px";
        abilityPanel.width = layout.width + "px";
        abilityPanel.height = layout.contentHeight + "px";
        abilityPanel.thickness = 0;
        abilityPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        abilityPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        paddingPanel.addControl(abilityPanel);

        for (let i = 1; i <= this._game.config.PLAYER_HOTBAR_SIZE; i++) {
            const column = (i - 1) % layout.columns;
            const row = Math.floor((i - 1) / layout.columns);
            const cellSize = layout.iconSize + layout.gutter;

            // container
            var headlineRect = new Rectangle("ability_" + i);
            headlineRect.top = row * cellSize + "px";
            headlineRect.left = column * cellSize + "px";
            headlineRect.width = layout.iconSize + "px";
            headlineRect.height = layout.iconSize + "px";
            headlineRect.thickness = 1;
            headlineRect.color = "rgba(217,170,67,.72)";
            headlineRect.background = "rgba(13,28,19,.88)";
            headlineRect.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            headlineRect.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
            abilityPanel.addControl(headlineRect);

            abilityRect[i] = headlineRect;
        }

        // add hotbar icons
        if (this._currentPlayer.entity.player_data.hotbar) {
            this._currentPlayer.entity.player_data.hotbar.forEach((data) => {
                let hotbarData;
                if (data.type === "item") {
                    hotbarData = this._game.getGameData("item", data.key);
                }
                if (data.type === "ability") {
                    hotbarData = this._game.getGameData("ability", data.key);
                }

                if (hotbarData) {
                    this.addIcon(data.digit, data, hotbarData, abilityRect[data.digit]);
                }
            });
        }
    }

    addIcon(digit, hotbar, hotbarData, headlineRect: Rectangle) {
        var img = new Image("ability_image_" + digit, "./images/icons/" + hotbarData.icon + ".png");
        img.stretch = Image.STRETCH_FILL;
        headlineRect.addControl(img);

        if (this._game.controlMode !== "touch") {
            headlineRect.onPointerEnterObservable.add(() => {
                this.showTooltip(hotbar.type, hotbarData, headlineRect);
            });

            headlineRect.onPointerOutObservable.add(() => {
                this.hideTooltip();
            });
        }

        headlineRect.onPointerClickObservable.add(() => {
            if (!this._currentPlayer.abilityController.isCasting) {
                this._game.sendMessage(ServerMsg.PLAYER_HOTBAR_ACTIVATED, {
                    senderId: this._room.sessionId,
                    targetId: this._game?.selectedEntity?.sessionId ?? false,
                    digit: digit,
                });
            }
        });

        // add ability number
        var abilityNumber = new Rectangle("abilityNumber" + digit + "_cooldown");
        abilityNumber.top = "0px";
        abilityNumber.left = "0px";
        abilityNumber.width = "18px";
        abilityNumber.height = "18px";
        abilityNumber.thickness = 0;
        abilityNumber.isVisible = true;
        abilityNumber.background = "rgba(5,12,8,.9)";
        abilityNumber.color = "#d9aa43";
        abilityNumber.thickness = 1;
        abilityNumber.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        abilityNumber.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        headlineRect.addControl(abilityNumber);

        var roomTxt = new TextBlock("ability_text_" + digit);
        roomTxt.text = "" + digit;
        roomTxt.fontSize = "12px";
        roomTxt.color = "#f2d37a";
        roomTxt.fontWeight = "bold";
        roomTxt.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        roomTxt.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        abilityNumber.addControl(roomTxt);

        // add cooldown
        var abilityCooldown = new Rectangle("ability_" + digit + "_cooldown");
        abilityCooldown.top = 0;
        abilityCooldown.left = 0;
        abilityCooldown.width = 1;
        abilityCooldown.height = 0;
        abilityCooldown.thickness = 0;
        abilityCooldown.isVisible = true;
        abilityCooldown.zIndex = 1;
        abilityCooldown.background = "rgba(0,0,0,.7)";
        abilityCooldown.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        abilityCooldown.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        headlineRect.addControl(abilityCooldown);
    }

    showTooltip(type, hotbarData, headlineRect) {
        if (type === "item") {
            this._UI._Tooltip.refresh("item", hotbarData, headlineRect, "center", "top");
        }
        if (type === "ability") {
            this._UI._Tooltip.refresh("ability", hotbarData, headlineRect, "center", "top");
        }
    }

    hideTooltip() {
        this._UI._Tooltip.close();
    }

    public resize() {
        const layout = this.getLayout();
        if (this.getLayoutKey(layout) !== this._layoutKey) {
            this._createUI();
        }
    }

    public setVisible(visible: boolean): void {
        if (this._abilityUI) {
            this._abilityUI.isVisible = visible;
        }
    }

    private getLayout(): HotbarLayout {
        const size = this._game.config.PLAYER_HOTBAR_SIZE;
        const touchMode = this._game.controlMode === "touch";
        const narrowTouch = touchMode && window.innerWidth < 600;
        const columns = narrowTouch ? 5 : size;
        const viewport = this._UI.getGuiViewport();
        const gutter = 4 * viewport.scaleX;
        const targetWidth = narrowTouch
            ? Math.min(282, window.innerWidth - 12)
            : touchMode
              ? Math.min(520, window.innerWidth - 24)
              : window.innerWidth < 700
                ? Math.min(460, window.innerWidth - 20)
                : 460;
        const width = Math.min(targetWidth * viewport.scaleX, viewport.width - 12 * viewport.scaleX);
        const iconSize = width / columns - gutter;
        const rows = Math.ceil(size / columns);
        const contentHeight = rows * (iconSize + gutter) - gutter;
        const offsetCss = touchMode ? (window.innerHeight <= 520 ? -130 : -150) : window.innerWidth < 700 ? -28 : -35;
        const offset = offsetCss * viewport.scaleY;

        return { columns, contentHeight, gutter, iconSize, offset, width };
    }

    private getLayoutKey(layout: HotbarLayout): string {
        return [layout.columns, layout.contentHeight, layout.offset, layout.width].map((value) => Math.round(value)).join(":");
    }
}
