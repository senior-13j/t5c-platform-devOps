import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock, TextWrapping } from "@babylonjs/gui/2D/controls/textBlock";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { InputText } from "@babylonjs/gui/2D/controls/inputText";
import { ScrollViewer } from "@babylonjs/gui/2D/controls/scrollViewers/scrollViewer";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { PlayerMessage, ServerMsg } from "../../../shared/types";
import { generatePanel, getBg, getPadding } from "./Theme";

export class ChatBox {
    private _playerUI;
    private _chatUI: StackPanel;
    private _chatUIScroll: ScrollViewer;
    private _chatRoom;
    private _game;
    private _currentPlayer;
    private _entities;
    private _colors;
    private _uiTexture: AdvancedDynamicTexture;

    private _chatButton;
    private _chatInput;
    public chatPanel;

    public messages: PlayerMessage[] = [];

    constructor(_playerUI, _chatRoom, _currentPlayer, _entities, _game, _uiTexture: AdvancedDynamicTexture) {
        this._playerUI = _playerUI;
        this._chatRoom = _chatRoom;
        this._game = _game;
        this._currentPlayer = _currentPlayer;
        this._entities = _entities;
        this._uiTexture = _uiTexture;

        this._colors = {
            event: "orange",
            system: "white",
            chat: "white",
        };

        // create ui
        this._createUI();

        // add ui events
        this._createEvents();

        // add messages
        this._refreshChatBox();
        if (this._game.controlMode === "touch") {
            this.setVisible(false);
        }
    }

    get chatInput(): InputText {
        return this._chatInput;
    }

    public focus(): void {
        this._currentPlayer?._input?.suspendMovement();
        if (this._chatInput) {
            this._uiTexture.focusedControl = this._chatInput;
        }
    }

    public isFocused(): boolean {
        return this._uiTexture.focusedControl === this._chatInput;
    }

    public setVisible(visible: boolean): void {
        if (this.chatPanel) {
            this.chatPanel.isVisible = visible;
        }
        if (!visible && this.isFocused()) {
            this._uiTexture.focusedControl = null;
        }
    }

    public isVisible(): boolean {
        return Boolean(this.chatPanel?.isVisible);
    }

    _createUI() {
        const chatPanel = generatePanel("chatPanel", "350px", "200px", "-35px", "15px");
        chatPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        chatPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        chatPanel.isPointerBlocker = true;
        this._playerUI.addControl(chatPanel);
        this.chatPanel = chatPanel;

        const paddingPanel = new Rectangle("paddingPanel");
        paddingPanel.width = 1;
        paddingPanel.height = 1;
        paddingPanel.thickness = 0;
        paddingPanel.setPaddingInPixels(getPadding());
        chatPanel.addControl(paddingPanel);

        // add chat input
        const chatInput = new InputText("chatInput");
        chatInput.width = 0.8;
        chatInput.height = "24px";
        chatInput.top = "0px";
        chatInput.color = "#FFF";
        chatInput.fontSize = "12px";
        chatInput.thickness = 0;
        chatInput.background = getBg();
        chatInput.placeholderText = this._game.t("chat.placeholder");
        chatInput.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        chatInput.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        paddingPanel.addControl(chatInput);
        this._chatInput = chatInput;

        // add chat send button
        const chatButton = Button.CreateSimpleButton("chatButton", this._game.t("chat.send"));
        chatButton.width = 0.2;
        chatButton.height = "24px";
        chatButton.top = "0px";
        chatButton.color = "#FFF";
        chatButton.fontSize = "12px";
        chatButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        chatButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        paddingPanel.addControl(chatButton);
        this._chatButton = chatButton;

        // add scrollable container
        const chatScrollViewer = new ScrollViewer("chatScrollViewer");
        chatScrollViewer.width = 1;
        chatScrollViewer.height = "168px";
        chatScrollViewer.top = "-22px";
        chatScrollViewer.thickness = 0;
        chatScrollViewer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        chatScrollViewer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        paddingPanel.addControl(chatScrollViewer);
        this._chatUIScroll = chatScrollViewer;

        // add stack panel
        const chatStackPanel = new StackPanel("chatStackPanel");
        chatStackPanel.width = "100%";
        chatStackPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        chatStackPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        chatStackPanel.paddingTop = "5px";
        chatScrollViewer.addControl(chatStackPanel);
        this._chatUI = chatStackPanel;

        // intial refresh chatbox
        this._refreshChatBox();
        this.resize();
    }

    _createEvents() {
        // on click send
        this._chatButton.onPointerDownObservable.add(() => {
            this.sendMessage();
        });

        // chatbox on enter event
        this._chatInput.onKeyboardEventProcessedObservable.add((ev) => {
            if ((ev.key === "Enter" || ev.code === "Enter") && this._chatInput.text != "") {
                this.sendMessage();
            }
        });

        this._chatRoom.onMessage(ServerMsg.SERVER_MESSAGE, (message: PlayerMessage) => {
            message.color = this._colors["chat"];
            this.addNotificationMessage("system", this._game.translateServerMessage(message.message), new Date());
        });

        // receive message event
        this._chatRoom.onMessage(ServerMsg.CHAT_MESSAGE, (message: PlayerMessage) => {
            message.color = this._colors["chat"];
            this.processMessage(message);
        });
    }

    // set current player
    public setCurrentPlayer(currentPlayer) {
        this._currentPlayer = currentPlayer;
    }

    // process incoming messages
    public processMessage(message) {
        this._game.currentChats.push(message);
        this._refreshChatBox();
        this.showChatMessageAboveEntity(message);
    }

    // process incoming messages
    public addNotificationMessage(type, message, date) {
        this.processNotificationMessage({
            type: type,
            senderID: "SYSTEM",
            message: message,
            name: "SYSTEM",
            timestamp: 0,
            createdAt: date,
            color: this._colors[type],
        });
    }

    // process incoming messages
    public processNotificationMessage(message) {
        this._game.currentChats.push(message);
        this._refreshChatBox();
    }

    // show chat message above player
    public showChatMessageAboveEntity(msg: PlayerMessage) {
        let player = this._entities.get(msg.senderID);
        if (msg.senderID === this._currentPlayer.sessionId) {
            player = this._currentPlayer;
        }
        if (player && player.nameplateController) {
            player.nameplateController.addChatMessage(msg.message);
        }
    }

    // send message to server
    private sendMessage() {
        this._chatRoom.send(ServerMsg.PLAYER_SEND_MESSAGE, {
            name: this._currentPlayer.name,
            message: this._chatInput.text,
            senderId: this._currentPlayer.sessionId,
        });
        this._chatInput.text = "";
        this._uiTexture.focusedControl = null;
        this._game.engine.getRenderingCanvas()?.focus();
    }

    // chat refresh
    public addChatMessage(msg: PlayerMessage) {
        this.messages.push(msg);
        this._refreshChatBox();
    }

    // chat refresh
    private _refreshChatBox() {
        if (!this._chatUI) {
            return false;
        }

        // remove all chat and refresh
        let elements = this._chatUI.getDescendants();
        elements.forEach((element) => {
            element.dispose();
        });

        this._chatUIScroll.verticalBar.value = 1;

        this._game.currentChats.slice().forEach((msg: PlayerMessage) => {
            // container
            var headlineRect = new Rectangle("chatMsgRect_" + msg.createdAt);
            headlineRect.width = "100%";
            headlineRect.thickness = 0;
            headlineRect.paddingBottom = "1px";
            headlineRect.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            headlineRect.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
            headlineRect.height = "50px";
            headlineRect.adaptHeightToChildren = true;
            this._chatUI.addControl(headlineRect);

            let prefix = this._game.t("chat.global", { name: msg.name });
            if (msg.senderID === "SYSTEM") {
                prefix = this._game.t("chat.system");
            }
            if (this._currentPlayer) {
                prefix =
                    msg.senderID == this._currentPlayer.sessionId
                        ? this._game.t("chat.youSaid")
                        : msg.senderID === "SYSTEM"
                          ? this._game.t("chat.system")
                          : this._game.t("chat.global", { name: msg.name });
            }

            // message
            var roomTxt = new TextBlock("chatMsgTxt_" + msg.createdAt);
            roomTxt.paddingLeft = "5px";
            roomTxt.text = prefix + msg.message;
            roomTxt.textHorizontalAlignment = 0;
            roomTxt.fontSize = "12px";
            roomTxt.color = msg.color;
            roomTxt.left = "0px";
            roomTxt.textWrapping = TextWrapping.WordWrap;
            roomTxt.resizeToFit = true;
            roomTxt.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            roomTxt.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
            headlineRect.addControl(roomTxt);
        });
    }

    public resize() {
        const touchMode = this._game.controlMode === "touch";
        const compact = touchMode || window.innerWidth < 700;
        if (!compact) {
            this.chatPanel.width = "350px";
            this.chatPanel.height = "200px";
            this.chatPanel.left = "15px";
            this.chatPanel.top = window.innerWidth < 1100 ? "-115px" : "-30px";
            this._chatUIScroll.height = "168px";
            this._chatInput.height = "24px";
            this._chatButton.height = "24px";
            this._chatInput.width = 0.8;
            this._chatButton.width = 0.2;
            return;
        }

        const viewport = this._uiTexture.getSize();
        const scaleX = viewport.width / (this._game.engine.getRenderingCanvas()?.clientWidth || window.innerWidth || 1);
        const scaleY = viewport.height / (this._game.engine.getRenderingCanvas()?.clientHeight || window.innerHeight || 1);
        const landscape = touchMode && window.innerHeight <= 520;
        const panelHeight = landscape ? 100 : 128;
        this.chatPanel.width = Math.min(240, window.innerWidth - 24) * scaleX + "px";
        this.chatPanel.height = panelHeight * scaleY + "px";
        this.chatPanel.left = 8 * scaleX + "px";
        this.chatPanel.top = (touchMode ? (landscape ? -183 : -260) : -82) * scaleY + "px";
        this._chatUIScroll.height = (landscape ? 50 : 78) * scaleY + "px";
        this._chatInput.height = 44 * scaleY + "px";
        this._chatButton.height = 44 * scaleY + "px";
        this._chatInput.width = compact ? 0.7 : 0.8;
        this._chatButton.width = compact ? 0.3 : 0.2;
    }
}
