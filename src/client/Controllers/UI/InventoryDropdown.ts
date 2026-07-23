import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { ItemClass, ServerMsg } from "../../../shared/types";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { UserInterface } from "../UserInterface";

export class InventoryDropdown {
    private _UI;
    private _selected;
    private _room;
    private _game;
    private dropdown: StackPanel;
    private _bgColor = "rgba(0,0,0,1";
    constructor(_UI: UserInterface) {
        this._UI = _UI;
        this._room = _UI._room;
        this._game = _UI._game;
    }

    public refresh() {
        if (this.dropdown) {
            this.dropdown.top = this._selected._currentMeasure.top + this._selected.heightInPixels;
            this.dropdown.left = this._selected._currentMeasure.left;
        }
    }

    public hideDropdown() {
        if (this.dropdown) {
            this.dropdown.dispose();
        }
    }

    public showDropdown(el: Rectangle, item, inventory) {
        if (this.dropdown) {
            this.hideDropdown();
        }

        this._selected = el;

        const touchMode = this._game.controlMode === "touch";
        const actionHeight = touchMode ? 46 : 24;
        const rect = new StackPanel("InventoryDropdown");
        rect.top = el._currentMeasure.top + el.heightInPixels;
        rect.left = el._currentMeasure.left;
        rect.width = touchMode ? "154px" : "100px";
        rect.height = "110px";
        rect.background = this._bgColor;
        rect.spacing = 2;
        rect.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        rect.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        rect.isVertical = true;
        rect.zIndex = 20;
        this._UI._playerUI.addControl(rect);
        this.dropdown = rect;

        let actions: any = [];
        if (item.class === ItemClass.ARMOR || item.class === ItemClass.WEAPON) {
            actions.push({
                title: this._game.t("inventory.equip"),
                click: () => {
                    this._game.sendMessage(ServerMsg.PLAYER_USE_ITEM, {
                        index: inventory.i,
                    });
                },
            });
        }
        if (item.class === ItemClass.CONSUMABLE) {
            actions.push({
                title: this._game.t("inventory.use"),
                click: () => {
                    this._game.sendMessage(ServerMsg.PLAYER_USE_ITEM, {
                        index: inventory.i,
                    });
                },
            });
        }
        actions.push({
            title: this._game.t("inventory.dropAll"),
            click: () => {
                this._game.sendMessage(ServerMsg.PLAYER_DROP_ITEM, {
                    slot: inventory.i,
                    drop_all: true,
                });
            },
        });

        if (inventory.qty > 1) {
            actions.push({
                title: this._game.t("inventory.dropOne"),
                click: () => {
                    this._game.sendMessage(ServerMsg.PLAYER_DROP_ITEM, {
                        slot: inventory.i,
                    });
                },
            });
        }

        actions.push({
            title: this._game.t("common.cancel"),
            click: () => {
                this.hideDropdown();
            },
        });

        rect.height = actionHeight * actions.length + "px";

        actions.forEach((action) => {
            const button = Button.CreateSimpleButton("but" + action.title, action.title);
            button.left = "0px";
            button.width = touchMode ? "150px" : "95px";
            button.height = touchMode ? "44px" : "22px";
            button.thickness = 0;
            button.background = "black";
            button.color = "white";
            if (button.textBlock) {
                button.textBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
                button.textBlock.fontSize = "14px";
            }
            rect.addControl(button);
            button.onPointerDownObservable.add(() => {
                action.click();
                this.hideDropdown();
                this._UI.panelInventory.refresh();
            });
        });
    }
}
