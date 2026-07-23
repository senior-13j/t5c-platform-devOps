import { Control, TextBlock } from "@babylonjs/gui/2D/controls";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { getBg, createButton, applyTheme } from "./Theme";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { Image } from "@babylonjs/gui/2D/controls/image";
import { UserInterface } from "../UserInterface";
import State from "../../Screens/Screens";
import { GameController } from "../GameController";
import { ServerMsg } from "../../../shared/types";
import { Tools } from "@babylonjs/core/Misc/tools";

export class MainMenu {
    private _UI: UserInterface;
    private _playerUI;
    private _engine: Engine;
    private _scene: Scene;
    private _game: GameController;
    private _room;
    private _currentPlayer;

    private _mainPanel: Rectangle;
    private _dropdownMenu: Rectangle;
    private _dropdownButton;
    private _menuGrid: StackPanel;
    private _menuButtons = [];

    constructor(_UI: UserInterface, _currentPlayer) {
        this._UI = _UI;
        this._playerUI = _UI._playerUI;
        this._scene = _UI._scene;
        this._currentPlayer = _currentPlayer;
        this._room = _UI._room;
        this._game = _UI._game;
        this._engine = _UI._engine;

        // mainmenu panel
        let mainmenuPanel = new Rectangle("mainmenuPanel");
        mainmenuPanel.top = "15px;";
        mainmenuPanel.left = "-15px;";
        mainmenuPanel.width = "400px;";
        mainmenuPanel.height = "60px";
        mainmenuPanel.thickness = 0;
        mainmenuPanel.isVisible = true;
        mainmenuPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        mainmenuPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this._playerUI.addControl(mainmenuPanel);
        this._mainPanel = mainmenuPanel;

        this._createUI();
        this._createDropdownMenu();
        this.resize();
    }

    takeScreenshot() {
        this._UI._Watermark._bloc.isVisible = true;
        Tools.CreateScreenshot(
            this._engine,
            this._currentPlayer.cameraController.camera,
            { width: 2560, height: 1440, precision: 0.9 },
            () => {
                this._UI._Watermark._bloc.isVisible = false;
                console.log("Screnshot taken!");
            },
            "image/jpeg",
            true,
            0.9
        );
    }

    _createDropdownMenu() {
        let dropdownOptions = {
            menuTitle: "O",
            children: {
                reset: {
                    menuTitle: this._game.t("menu.stuck"),
                    click: () => {
                        this._game.sendMessage(ServerMsg.PLAYER_RESET_POSITION);
                    },
                },
                screenshot: {
                    menuTitle: this._game.t("menu.screenshot"),
                    click: () => {
                        this.takeScreenshot();
                    },
                },
                /*
                debug: {
                    menuTitle: "Debug Scene",
                    click: () => {
                         // leave colyseus rooms
                        this._room.leave();
                        this._game.currentChat.leave();
                        this._game.setScene(State.DEBUG_SCENE);
                    },
                },*/
                quit: {
                    menuTitle: this._game.t("menu.quit"),
                    click: () => {
                        this._currentPlayer.quit();
                    },
                },
            },
        };

        let button = createButton("button_dropdown", dropdownOptions.menuTitle, "30px", "30px");
        button.top = "0px;";
        button.left = "0px;";
        button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        button.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this._mainPanel.addControl(button);
        this._dropdownButton = button;

        var b1 = new Image("b1", "./images/ui/gear-solid.png");
        b1.stretch = Image.STRETCH_UNIFORM;
        button.addControl(b1);

        let drowpdownMenu = new Rectangle("drowpdownMenu");
        drowpdownMenu.top = "60px;";
        drowpdownMenu.left = "-15px;";
        drowpdownMenu.width = "150px;";
        drowpdownMenu.height = "100px";
        drowpdownMenu.isVisible = false;
        drowpdownMenu.adaptHeightToChildren = true;
        drowpdownMenu.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        drowpdownMenu.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        applyTheme(drowpdownMenu);
        this._playerUI.addControl(drowpdownMenu);
        this._dropdownMenu = drowpdownMenu;

        const grid = new StackPanel("drowpdownStack");
        grid.top = "0px";
        grid.left = "0px";
        grid.width = 1;
        grid.spacing = 5;
        grid.setPadding(5, 0, 5, 0);
        grid.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        grid.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        drowpdownMenu.addControl(grid);

        button.onPointerDownObservable.add(() => {
            drowpdownMenu.isVisible = !drowpdownMenu.isVisible;
        });

        let i = 0;
        for (let index in dropdownOptions.children) {
            let menuItem = dropdownOptions.children[index];
            let button = createButton("button_" + i, menuItem.menuTitle, 1, "30px");
            button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
            button.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            grid.addControl(button);
            if (menuItem.click) {
                button.onPointerDownObservable.add(() => {
                    menuItem.click();
                    drowpdownMenu.isVisible = false;
                });
            }
            i++;
        }
    }

    _createUI() {
        let menuItems = {
            inventory: {
                menuTitle: this._game.t("menu.inventory"),
                icon: "ICON_MENU_inventory",
                click: () => {
                    this.openPanel("inventory");
                },
            },
            quests: {
                menuTitle: this._game.t("menu.quests"),
                icon: "ICON_MENU_quest",
                click: () => {
                    this.openPanel("quests");
                },
            },
            abilities: {
                menuTitle: this._game.t("menu.abilities"),
                icon: "ICON_MENU_abilities",
                click: () => {
                    this.openPanel("abilities");
                },
            },
            character: {
                menuTitle: this._game.t("menu.character"),
                icon: "ICON_MENU_character",
                click: () => {
                    this.openPanel("character");
                },
            },
            help: {
                menuTitle: this._game.t("menu.help"),
                icon: "ICON_MENU_help",
                click: () => {
                    this.openPanel("help");
                },
            },
        };

        const grid = new StackPanel("mainmenu");
        grid.top = "0px";
        grid.left = "-40px";
        grid.height = "30px;";
        grid.spacing = 5;
        grid.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        grid.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        grid.isVertical = false;
        this._mainPanel.addControl(grid);
        this._menuGrid = grid;

        // add menu tooltip
        const buttonTooltip = createButton("button_tooltip", "", "100px", "30px", "");
        grid.addControl(buttonTooltip);
        let buttonTooltipText = buttonTooltip.getChildByName("button_tooltip_text") as TextBlock;
        buttonTooltip.isVisible = false;

        //
        let i = 0;
        for (let index in menuItems) {
            let menuItem = menuItems[index];
            const button = createButton("button_" + i, "", "35px", "30px", menuItem.icon);
            grid.addControl(button);
            this._menuButtons.push(button);

            if (menuItem.click) {
                button.onPointerDownObservable.add(() => {
                    menuItem.click();
                });
            }

            button.onPointerEnterObservable.add(() => {
                buttonTooltipText.text = menuItem.menuTitle;
                buttonTooltip.isVisible = true;
            });

            button.onPointerOutObservable.add(() => {
                buttonTooltipText.text = "";
                buttonTooltip.isVisible = false;
            });

            i++;
        }
    }

    public openPanel(key) {
        switch (key) {
            case "inventory":
                this._UI.panelInventory.open();
                break;
            case "character":
                this._UI.panelCharacter.open();
                break;
            case "abilities":
                this._UI.panelAbilities.open();
                break;
            case "help":
                this._UI.panelHelp.open();
                break;
            case "quests":
                this._UI.panelQuests.open();
                break;
        }
    }

    public setVisible(visible: boolean): void {
        this._mainPanel.isVisible = visible;
        if (!visible) {
            this._dropdownMenu.isVisible = false;
        }
    }

    public resize() {
        const compact = this._game.controlMode === "touch" || window.innerWidth < 700;
        if (!compact) {
            this._mainPanel.top = "15px";
            this._mainPanel.left = "-15px";
            this._mainPanel.width = "400px";
            this._mainPanel.height = "60px";
            this._menuGrid.left = "-40px";
            this._menuGrid.height = "30px";
            this._menuGrid.spacing = 5;
            this._dropdownButton.width = "30px";
            this._dropdownButton.height = "30px";
            this._menuButtons.forEach((button) => {
                button.width = "35px";
                button.height = "30px";
            });
            this._dropdownMenu.top = "60px";
            this._dropdownMenu.left = "-15px";
            return;
        }

        const viewport = this._UI.getGuiViewport();
        const x = (value: number) => value * viewport.scaleX + "px";
        const y = (value: number) => value * viewport.scaleY + "px";
        this._mainPanel.top = y(80);
        this._mainPanel.left = x(-8);
        this._mainPanel.width = x(Math.min(300, window.innerWidth - 8));
        this._mainPanel.height = y(48);

        this._menuGrid.left = x(-48);
        this._menuGrid.height = y(44);
        this._menuGrid.spacing = 4 * viewport.scaleX;
        this._dropdownButton.width = x(44);
        this._dropdownButton.height = y(44);

        this._menuButtons.forEach((button) => {
            button.width = x(44);
            button.height = y(44);
        });

        this._dropdownMenu.top = y(132);
        this._dropdownMenu.left = x(-8);
    }
}
