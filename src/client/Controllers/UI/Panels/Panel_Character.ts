import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { Panel } from "./Panel";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { applyTheme, createButton } from "../Theme";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Image } from "@babylonjs/gui/2D/controls/image";
import { ServerMsg } from "../../../../shared/types";
import { Rarity } from "../../../../shared/Class/Rarity";

export class Panel_Character extends Panel {
    // inventory tab
    private panel: Rectangle;
    private attributes;
    private stats;
    private slots;

    private leftPanel: Rectangle;
    private rightPanel: Rectangle;
    private slotPanel: Rectangle;

    constructor(_UI, _currentPlayer, options) {
        super(_UI, _currentPlayer, options);

        //
        this.attributes = {
            strength: {
                name: this._game.t("attribute.strength"),
                button: true,
            },
            endurance: {
                name: this._game.t("attribute.endurance"),
                button: true,
            },
            agility: {
                name: this._game.t("attribute.agility"),
                button: true,
            },
            intelligence: {
                name: this._game.t("attribute.intelligence"),
                button: true,
            },
            wisdom: {
                name: this._game.t("attribute.wisdom"),
                button: true,
            },
            ac: {
                name: this._game.t("attribute.ac"),
                button: false,
            },
            points: {
                name: this._game.t("attribute.points"),
            },
        };

        //
        this.stats = {
            name: {
                label: this._game.t("character.name"),
                value: this._currentPlayer.name,
            },
            sessionId: {
                label: this._game.t("character.id"),
                value: this._currentPlayer.sessionId,
            },
            level: {
                label: this._game.t("common.level"),
                value: this._currentPlayer.level,
            },
            race: {
                label: this._game.t("character.race"),
                value: this._game.getGameData("race", this._currentPlayer.race)?.title ?? this._currentPlayer.race,
            },
            health: {
                label: this._game.t("character.health"),
                value: this._currentPlayer.health + "/" + this._currentPlayer.maxHealth,
            },
            mana: {
                label: this._game.t("character.mana"),
                value: this._currentPlayer.mana + "/" + this._currentPlayer.maxMana,
            },
        };

        this.slots = [
            this._game.t("slot.head"),
            this._game.t("slot.amulet"),
            this._game.t("slot.chest"),
            this._game.t("slot.pants"),
            this._game.t("slot.shoes"),
            this._game.t("slot.weapon"),
            this._game.t("slot.offHand"),
            this._game.t("slot.ring1"),
            this._game.t("slot.ring2"),
            this._game.t("slot.back"),
        ];

        // create UI
        this.createPanels();
        this.createContent();

        // dynamic events
        let entity = this._currentPlayer.entity;
        if (entity) {
            entity.player_data.onChange((item, sessionId) => {
                this.leftPanelContent(this.leftPanel);
                this.rightPanelContent(this.rightPanel);
            });
            entity.equipment.onAdd((item, sessionId) => {
                this.slotPanelContentRefresh("ADD", this.slotPanel, item);
            });
            entity.equipment.onRemove((item, sessionId) => {
                this.slotPanelContentRefresh("REMOVE", this.slotPanel, item);
            });
        }
    }

    // open panel
    public open() {
        super.open();
    }

    // create content
    public createContent() {
        this.leftPanelContent(this.leftPanel);
        this.rightPanelContent(this.rightPanel);
        this.slotPanelContent(this.slotPanel);
    }

    // create panel
    private createPanels() {
        let panel: Rectangle = this._panelContent;

        // left panel
        let leftPanel = new Rectangle("leftPanel");
        leftPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        leftPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        leftPanel.top = "0px";
        leftPanel.left = "0px";
        leftPanel.width = 0.485;
        leftPanel.height = 0.8;
        leftPanel.thickness = 0;
        leftPanel.paddingLeft = "0px";
        leftPanel.paddingBottom = "5px";
        panel.addControl(leftPanel);
        this.leftPanel = leftPanel;

        // right panel
        let rightPanel = new Rectangle("rightPanel");
        rightPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        rightPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        rightPanel.top = "0px";
        rightPanel.left = "0px";
        rightPanel.width = 0.485;
        rightPanel.height = 0.8;
        rightPanel.thickness = 0;
        rightPanel.paddingLeft = "0px";
        rightPanel.paddingBottom = "5px";
        panel.addControl(rightPanel);
        this.rightPanel = rightPanel;

        // bottom panel
        let slotPanel = new Rectangle("slotPanel");
        slotPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        slotPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        slotPanel.top = "0px";
        slotPanel.left = "0px";
        slotPanel.width = 1;
        slotPanel.adaptHeightToChildren = true;
        slotPanel.thickness = 0;
        slotPanel.paddingLeft = "7px";
        slotPanel.paddingRight = "7px";
        slotPanel.paddingBottom = "7px";
        panel.addControl(slotPanel);
        this.slotPanel = slotPanel;
    }

    private leftPanelContent(panel) {
        const touchMode = this._game.controlMode === "touch";
        const viewport = this._UI.getGuiViewport();
        // if already exists
        panel.children.forEach((el) => {
            el.dispose();
        });

        // panel title
        const stackPanel = new StackPanel("stackPanel");
        stackPanel.width = 1;
        stackPanel.adaptHeightToChildren = true;
        stackPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        stackPanel.setPaddingInPixels(5, 5, 5, 5);
        panel.addControl(stackPanel);

        for (let key in this.stats) {
            // get ability details
            let line = this.stats[key];

            let panelRectangle = new Rectangle("cont" + key);
            panelRectangle.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            panelRectangle.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
            panelRectangle.top = "0px";
            panelRectangle.left = "0px";
            panelRectangle.width = 1;
            panelRectangle.height = touchMode ? 44 * viewport.scaleY + "px" : "30px";
            panelRectangle.background = "#CCC";
            panelRectangle.thickness = 1;
            panelRectangle.paddingLeft = "0px";
            panelRectangle.paddingBottom = "5px";
            applyTheme(panelRectangle);
            stackPanel.addControl(panelRectangle);

            const tooltipName = new TextBlock("name" + key);
            tooltipName.color = "#FFF";
            tooltipName.top = "0px";
            tooltipName.left = "5px";
            tooltipName.fontSize = touchMode ? "12px" : "14px";
            tooltipName.resizeToFit = false;
            tooltipName.width = touchMode ? 0.46 : 0.52;
            tooltipName.height = 1;
            tooltipName.text = line.label;
            tooltipName.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            tooltipName.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            tooltipName.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            tooltipName.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            panelRectangle.addControl(tooltipName);

            const valueText = new TextBlock("valueText" + key);
            valueText.color = "#FFF";
            valueText.top = "0px";
            valueText.left = "-5px";
            valueText.fontSize = touchMode ? "12px" : "14px";
            valueText.resizeToFit = false;
            valueText.width = touchMode ? 0.52 : 0.46;
            valueText.height = 1;
            valueText.text = line.value;
            valueText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
            valueText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
            valueText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            valueText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            panelRectangle.addControl(valueText);
        }
    }

    private rightPanelContent(panel) {
        const touchMode = this._game.controlMode === "touch";
        const viewport = this._UI.getGuiViewport();
        // if already exists
        panel.children.forEach((el) => {
            el.dispose();
        });

        // panel title
        const stackPanel = new StackPanel("stackPanel");
        stackPanel.width = 1;
        stackPanel.adaptHeightToChildren = true;
        stackPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        stackPanel.setPaddingInPixels(5, 5, 5, 5);
        panel.addControl(stackPanel);

        for (let key in this.attributes) {
            // get ability details
            let line = this.attributes[key];

            let panelRectangle = new Rectangle("cont" + key);
            panelRectangle.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            panelRectangle.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
            panelRectangle.top = "0px";
            panelRectangle.left = "0px";
            panelRectangle.width = 1;
            panelRectangle.height = touchMode ? 44 * viewport.scaleY + "px" : "30px";
            panelRectangle.background = "#CCC";
            panelRectangle.thickness = 1;
            panelRectangle.paddingLeft = "0px";
            panelRectangle.paddingBottom = "5px";
            applyTheme(panelRectangle);
            stackPanel.addControl(panelRectangle);

            const tooltipName = new TextBlock("name" + key);
            tooltipName.color = "#FFF";
            tooltipName.top = "0px";
            tooltipName.left = "5px";
            tooltipName.fontSize = touchMode ? "11px" : "14px";
            tooltipName.resizeToFit = false;
            tooltipName.width = touchMode ? 0.54 : 0.7;
            tooltipName.height = 1;
            tooltipName.text = line.name;
            tooltipName.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            tooltipName.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            tooltipName.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            tooltipName.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            panelRectangle.addControl(tooltipName);

            const valueText = new TextBlock("valueText" + key);
            valueText.color = "#FFF";
            valueText.top = "0px";
            valueText.left = "-5px";
            valueText.fontSize = touchMode ? "12px" : "14px";
            valueText.resizeToFit = false;
            valueText.width = touchMode ? 0.18 : 0.25;
            valueText.height = 1;
            valueText.text = this._currentPlayer.player_data[key] ?? "ERROR";
            valueText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
            valueText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
            valueText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            valueText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            panelRectangle.addControl(valueText);

            //
            if (line.button && this._currentPlayer.player_data.points > 0) {
                const buttonSize = touchMode ? 44 * viewport.scaleX + "px" : "20px";
                let button = createButton("button", "+", buttonSize, buttonSize);
                button.background = "green";
                button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
                button.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
                panelRectangle.addControl(button);
                button.onPointerDownObservable.add(() => {
                    this._game.sendMessage(ServerMsg.PLAYER_ADD_STAT_POINT, {
                        key: key,
                    });
                });

                // push the value text to the left
                valueText.left = touchMode ? -(48 * viewport.scaleX) + "px" : "-30px";
            }
        }
    }

    private slotPanelContent(panel: Rectangle) {
        const touchMode = this._game.controlMode === "touch";
        const width = touchMode ? Math.min(484, window.innerWidth - 48) : 484;
        const columns = touchMode ? 5 : this.slots.length;
        const rows = Math.ceil(this.slots.length / columns);
        const iconGutter = 4;
        const iconWidth = width / columns - iconGutter;
        panel.height = rows * (iconWidth + iconGutter) + "px";
        panel.adaptHeightToChildren = false;

        let i = 0;
        this.slots.forEach((line) => {
            i++;

            let iconLeft = iconWidth + iconGutter;
            let leftMargin = ((i - 1) % columns) * iconLeft + "px";
            let topMargin = Math.floor((i - 1) / columns) * (iconWidth + iconGutter) + "px";

            let panelRectangle = new Rectangle("slot_" + i);
            panelRectangle.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            panelRectangle.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
            panelRectangle.top = topMargin;
            panelRectangle.left = leftMargin;
            panelRectangle.width = iconWidth + "px";
            panelRectangle.height = iconWidth + "px";
            panelRectangle.thickness = 2;
            panelRectangle.color = "rgba(255,255,255, .3";
            panel.addControl(panelRectangle);

            var panelText = new TextBlock("slot_text_" + i);
            panelText.text = line;
            panelText.fontSize = touchMode ? "9px" : "10px";
            panelText.textWrapping = true;
            panelText.color = "rgba(255,255,255, .3)";
            panelText.fontWeight = "bold";
            panelText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            panelText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
            panelRectangle.addControl(panelText);

            // add icon
            var img = new Image("slot_image_" + i, "./");
            img.stretch = Image.STRETCH_FILL;
            panelRectangle.addControl(img);
        });

        this.reflowSlots(panel);
    }

    private slotPanelContentRefresh(type, panel: Rectangle, data) {
        // get information
        let slot_id = data.slot;
        let item_key = data.key;
        let slotPanel = panel.getChildByName("slot_" + slot_id) as Rectangle;
        let slotImage = slotPanel.getChildByName("slot_image_" + slot_id) as Image;
        let item = this._game.getGameData("item", item_key);

        // make sure to remove any exisiting events
        slotImage.source = "";
        slotPanel.onPointerClickObservable.clear();
        slotPanel.onPointerEnterObservable.clear();
        slotPanel.onPointerOutObservable.clear();

        // equip item
        if (type === "ADD") {
            // color based on rarity
            let color = Rarity.getColor(item);
            slotPanel.background = color.bg;
            slotPanel.color = color.color;
            slotPanel.thickness = 2;

            //
            var imageData = this._loadedAssets[item.icon];
            slotImage.source = imageData;

            slotPanel.onPointerClickObservable.add((e) => {
                if (e.buttonIndex === 2 || (this._game.controlMode === "touch" && e.buttonIndex === 0)) {
                    this._game.sendMessage(ServerMsg.PLAYER_UNEQUIP_ITEM, {
                        key: item.key,
                    });
                }
            });

            slotPanel.onPointerEnterObservable.add((e) => {
                this._UI._Tooltip.refresh("item", item, slotPanel, "center", "top");
            });

            slotPanel.onPointerOutObservable.add((e) => {
                this._UI._Tooltip.close();
            });
        }

        if (type === "REMOVE") {
            slotPanel.background = "transparent";
            slotPanel.color = "rgba(255,255,255, .3";
        }
    }

    public resize() {
        super.resize();
        if (this.slotPanel) {
            this.reflowSlots(this.slotPanel);
        }
    }

    private reflowSlots(panel: Rectangle): void {
        const touchMode = this._game.controlMode === "touch";
        const panelWidth = this._panel.widthInPixels || this._UI.getGuiViewport().width;
        const width = touchMode ? Math.min(484, panelWidth - 14) : 484;
        const columns = touchMode && window.innerWidth < 600 ? 5 : this.slots.length;
        const rows = Math.ceil(this.slots.length / columns);
        const iconGutter = 4;
        const iconWidth = width / columns - iconGutter;

        panel.width = width + "px";
        panel.height = rows * (iconWidth + iconGutter) + "px";
        this.leftPanel.height = touchMode && columns === 5 ? 0.62 : 0.8;
        this.rightPanel.height = touchMode && columns === 5 ? 0.62 : 0.8;

        for (let index = 0; index < this.slots.length; index++) {
            const slot = panel.getChildByName("slot_" + (index + 1)) as Rectangle;
            if (!slot) {
                continue;
            }
            slot.left = (index % columns) * (iconWidth + iconGutter) + "px";
            slot.top = Math.floor(index / columns) * (iconWidth + iconGutter) + "px";
            slot.width = iconWidth + "px";
            slot.height = iconWidth + "px";
        }
    }
}
