import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { TextBlock, TextWrapping } from "@babylonjs/gui/2D/controls/textBlock";
import { Panel_Dialog } from "../..";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { Quest, QuestObjective, QuestObjectiveMap, QuestStatus, ServerMsg } from "../../../../../shared/types";
import { QuestsHelper } from "../../../../../shared/Class/QuestsHelper";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { GameController } from "../../../GameController";

export class QuestDialog {
    private panel: Panel_Dialog;
    private _game: GameController;
    public currentQuest: Quest;
    public currentLocation;
    public playerQuest;
    public questReadyToComplete;

    public dialogStackPanel;

    public DEFAULT_TEXT_ACCEPTED: string;
    public DEFAULT_TEXT_ONGOING: string;
    public DEFAULT_TEXT_READYTOCOMPLETE: string;
    public DEFAULT_TEXT_COMPLETED: string;

    constructor(panel: Panel_Dialog, quest_id) {
        this.panel = panel;
        this._game = panel._game;
        this.DEFAULT_TEXT_ACCEPTED = this._game.t("quest.acceptedText");
        this.DEFAULT_TEXT_ONGOING = this._game.t("quest.ongoingText");
        this.DEFAULT_TEXT_READYTOCOMPLETE = this._game.t("quest.readyText");
        this.DEFAULT_TEXT_COMPLETED = this._game.t("quest.completedText");
        this.dialogStackPanel = this.panel.dialogStackPanel;

        // show back button
        const createBtn = Button.CreateSimpleButton("characterBtn", this._game.t("common.back"));
        createBtn.left = "0px";
        createBtn.top = "0px";
        createBtn.width = 1;
        createBtn.height = this.panel.getActionHeight();
        createBtn.background = "black";
        createBtn.color = "white";
        createBtn.thickness = 0;
        createBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        createBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.panel.dialogStackPanel.addControl(createBtn);
        createBtn.onPointerDownObservable.add(() => {
            this.panel.nextStep(0);
        });

        // get quest
        this.currentQuest = this.panel._game.getGameData("quest", quest_id);
        this.currentLocation = this.panel._game.getGameData("location", this.currentQuest.location);

        // get player quest
        const playerQuests = this.panel._currentPlayer.player_data.quests;
        this.playerQuest = playerQuests?.get?.(quest_id) ?? playerQuests?.[quest_id] ?? false;

        // is quest completed
        this.questReadyToComplete = this.isQuestReadyToComplete();

        //
        this.create();
    }

    create() {
        // create quest title textblock
        let dialogTitleBlock = new TextBlock("dialogTitleBlock");
        dialogTitleBlock.text = this.currentQuest.title;
        dialogTitleBlock.fontSize = "16px";
        dialogTitleBlock.fontWeight = "bold";
        dialogTitleBlock.color = "white";
        dialogTitleBlock.textWrapping = TextWrapping.WordWrap;
        dialogTitleBlock.resizeToFit = true;
        dialogTitleBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dialogTitleBlock.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dialogTitleBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.panel.dialogStackPanel.addControl(dialogTitleBlock);

        // create main description textblock
        let dialogTextBlock = new TextBlock("dialogText");
        dialogTextBlock.text = "";
        dialogTextBlock.fontSize = "14px";
        dialogTextBlock.color = "white";
        dialogTextBlock.textWrapping = TextWrapping.WordWrap;
        dialogTextBlock.resizeToFit = true;
        dialogTextBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dialogTextBlock.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dialogTextBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.panel.dialogStackPanel.addControl(dialogTextBlock);

        // quest ready to complete
        if (this.questReadyToComplete) {
            console.log("QUEST questReadyToComplete");
            let dialogText = this.DEFAULT_TEXT_READYTOCOMPLETE;
            dialogText = this.replaceKeywords(dialogText);
            dialogTextBlock.text = dialogText;

            // show rewards
            this.showRewards(this.currentQuest.rewards);

            // complete quest button
            const createBtn = Button.CreateSimpleButton("characterBtn", this._game.t("quest.complete"));
            createBtn.left = "0px";
            createBtn.top = "0px";
            createBtn.width = 1;
            createBtn.height = this.panel.getActionHeight();
            createBtn.background = "black";
            createBtn.color = "white";
            createBtn.thickness = 0;
            this.dialogStackPanel.addControl(createBtn);

            createBtn.onPointerDownObservable.add(() => {
                // send event to server
                this._game.sendMessage(ServerMsg.PLAYER_QUEST_UPDATE, {
                    key: this.currentQuest.key,
                    status: QuestStatus.READY_TO_COMPLETE,
                });
                // close dialog
                this.showCompleted();
            });
        }

        // quest accepted
        if (this.playerQuest && this.playerQuest.status === 0 && !this.questReadyToComplete) {
            console.log("QUEST ACCEPTED");
            let dialogText = this.DEFAULT_TEXT_ONGOING;
            dialogText = this.replaceKeywords(dialogText);
            dialogTextBlock.text = dialogText;

            // show quest objective
            this.showObjective();
        }

        // quest completed
        if (this.playerQuest && this.playerQuest.status === 1) {
            console.log("QUEST COMPLETED");
            this.showCompleted();
        }

        // quest not started
        if (!this.playerQuest) {
            console.log("QUEST NOT STARTED");
            let dialogText = this.currentQuest.description;
            dialogText = this.replaceKeywords(dialogText);
            dialogTextBlock.text = dialogText;

            // show quest objective
            this.showObjective();

            // show accept button
            const dialogBtnAccept = Button.CreateSimpleButton("dialogBtnAccept", this._game.t("quest.accept"));
            dialogBtnAccept.width = 1;
            dialogBtnAccept.height = this.panel.getActionHeight();
            dialogBtnAccept.background = "black";
            dialogBtnAccept.color = "white";
            dialogBtnAccept.thickness = 0;
            this.dialogStackPanel.addControl(dialogBtnAccept);
            dialogBtnAccept.onPointerDownObservable.add(() => {
                // sent event to server
                this._game.sendMessage(ServerMsg.PLAYER_QUEST_UPDATE, {
                    key: this.currentQuest.key,
                    status: QuestStatus.ACCEPTED,
                });
                // go to end dialog
                this.showAccepted();
            });

            // show decline button
            const dialogBtnDecline = Button.CreateSimpleButton("dialogBtnDecline", this._game.t("quest.decline"));
            dialogBtnDecline.width = 1;
            dialogBtnDecline.height = this.panel.getActionHeight();
            dialogBtnDecline.background = "black";
            dialogBtnDecline.color = "white";
            dialogBtnDecline.thickness = 0;
            this.dialogStackPanel.addControl(dialogBtnDecline);
            dialogBtnDecline.onPointerDownObservable.add(() => {
                console.log("DECLINE");
                this.panel.nextStep(0);
            });
        }
    }

    public showCompleted() {
        this.panel.clear();

        // show back button
        const createBtn = Button.CreateSimpleButton("characterBtn", this._game.t("common.back"));
        createBtn.left = "0px";
        createBtn.top = "0px";
        createBtn.width = 1;
        createBtn.height = this.panel.getActionHeight();
        createBtn.background = "black";
        createBtn.color = "white";
        createBtn.thickness = 0;
        createBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        createBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.panel.dialogStackPanel.addControl(createBtn);
        createBtn.onPointerDownObservable.add(() => {
            this.panel.nextStep(0);
        });

        const dialogBtnAccept = Button.CreateSimpleButton("dialogBtnAccept", this._game.t("quest.completed"));
        dialogBtnAccept.width = 1;
        dialogBtnAccept.height = this.panel.getActionHeight();
        dialogBtnAccept.background = "black";
        dialogBtnAccept.color = "orange";
        dialogBtnAccept.thickness = 0;
        this.panel.dialogStackPanel.addControl(dialogBtnAccept);

        // create quest title textblock
        let dialogTitleBlock = new TextBlock("dialogTitleBlock");
        dialogTitleBlock.text = this.currentQuest.title;
        dialogTitleBlock.fontSize = "16px";
        dialogTitleBlock.fontWeight = "bold";
        dialogTitleBlock.color = "white";
        dialogTitleBlock.textWrapping = TextWrapping.WordWrap;
        dialogTitleBlock.resizeToFit = true;
        dialogTitleBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dialogTitleBlock.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dialogTitleBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.panel.dialogStackPanel.addControl(dialogTitleBlock);

        // create main description textblock
        let dialogTextBlock = new TextBlock("dialogText");
        dialogTextBlock.text = this.DEFAULT_TEXT_COMPLETED;
        dialogTextBlock.fontSize = "14px";
        dialogTextBlock.color = "white";
        dialogTextBlock.textWrapping = TextWrapping.WordWrap;
        dialogTextBlock.resizeToFit = true;
        dialogTextBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dialogTextBlock.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dialogTextBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.panel.dialogStackPanel.addControl(dialogTextBlock);
    }

    public showAccepted() {
        this.panel.clear();

        // show back button
        const createBtn = Button.CreateSimpleButton("characterBtn", this._game.t("common.back"));
        createBtn.left = "0px";
        createBtn.top = "0px";
        createBtn.width = 1;
        createBtn.height = this.panel.getActionHeight();
        createBtn.background = "black";
        createBtn.color = "white";
        createBtn.thickness = 0;
        createBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        createBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.panel.dialogStackPanel.addControl(createBtn);
        createBtn.onPointerDownObservable.add(() => {
            this.panel.nextStep(0);
        });

        const dialogBtnAccept = Button.CreateSimpleButton("dialogBtnAccept", this._game.t("quest.accepted"));
        dialogBtnAccept.width = 1;
        dialogBtnAccept.height = this.panel.getActionHeight();
        dialogBtnAccept.background = "black";
        dialogBtnAccept.color = "orange";
        dialogBtnAccept.thickness = 0;
        this.panel.dialogStackPanel.addControl(dialogBtnAccept);

        // create quest title textblock
        let dialogTitleBlock = new TextBlock("dialogTitleBlock");
        dialogTitleBlock.text = this.currentQuest.title;
        dialogTitleBlock.fontSize = "16px";
        dialogTitleBlock.fontWeight = "bold";
        dialogTitleBlock.color = "white";
        dialogTitleBlock.textWrapping = TextWrapping.WordWrap;
        dialogTitleBlock.resizeToFit = true;
        dialogTitleBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dialogTitleBlock.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dialogTitleBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.panel.dialogStackPanel.addControl(dialogTitleBlock);

        // create main description textblock
        let dialogTextBlock = new TextBlock("dialogText");
        dialogTextBlock.text = this.DEFAULT_TEXT_ACCEPTED;
        dialogTextBlock.fontSize = "14px";
        dialogTextBlock.color = "white";
        dialogTextBlock.textWrapping = TextWrapping.WordWrap;
        dialogTextBlock.resizeToFit = true;
        dialogTextBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dialogTextBlock.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dialogTextBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.panel.dialogStackPanel.addControl(dialogTextBlock);

        // show quest objective
        this.showObjective();
    }

    public showObjective() {
        let dialogObjective = new TextBlock("dialogObjective");
        dialogObjective.text = this.replaceKeywords(this.currentQuest.objective);
        dialogObjective.fontSize = "14px";
        dialogObjective.color = "orange";
        dialogObjective.textWrapping = TextWrapping.WordWrap;
        dialogObjective.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dialogObjective.resizeToFit = true;
        this.panel.dialogStackPanel.addControl(dialogObjective);
    }

    public showRewards(rewards) {
        if (rewards.experience) {
            let dialogRewards = new TextBlock("dialogRewards-experience");
            dialogRewards.text = this._game.t("quest.rewardExperience", { amount: rewards.experience });
            dialogRewards.fontSize = "14px";
            dialogRewards.color = "orange";
            dialogRewards.resizeToFit = true;
            dialogRewards.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            this.dialogStackPanel.addControl(dialogRewards);
        }

        if (rewards.gold) {
            let dialogRewards = new TextBlock("dialogRewards-gold");
            dialogRewards.text = this._game.t("quest.rewardGold", { amount: rewards.gold });
            dialogRewards.fontSize = "14px";
            dialogRewards.color = "orange";
            dialogRewards.resizeToFit = true;
            dialogRewards.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            this.dialogStackPanel.addControl(dialogRewards);
        }

        if (rewards.items && rewards.items.length > 0) {
            rewards.items.forEach((item) => {
                let dialogRewards = new TextBlock("dialogRewards-item-" + item.key);
                const itemData = this._game.getGameData("item", item.key);
                dialogRewards.text = this._game.t("quest.rewardItem", { item: itemData?.title ?? item.key });
                dialogRewards.fontSize = "14px";
                dialogRewards.color = "orange";
                dialogRewards.resizeToFit = true;
                dialogRewards.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
                this.dialogStackPanel.addControl(dialogRewards);
            });
        }
    }

    public replaceKeywords(text) {
        text = text.replace("@NpcName", this.panel.currentEntity.name);
        text = text.replace("@LocationName", this.panel._game.currentLocation.title);
        text = text.replace("@PlayerName", this.panel._currentPlayer.name);
        if (this.currentQuest) {
            text = text.replace("@KillRequired", this.currentQuest.quantity);
            text = text.replace("@TargetName", QuestsHelper.findQuestTargetName(this.currentLocation, this.currentQuest.spawn_key, this.currentQuest.quantity));
        }
        if (this.playerQuest) {
            text = text.replace("@KillCompleted", this.playerQuest.qty);
        }
        if (this.playerQuest && this.currentQuest) {
            text = text.replace("@KillRemaining", this.currentQuest.quantity - this.playerQuest.qty);
        }
        return text;
    }

    public isQuestReadyToComplete() {
        if (this.playerQuest && this.currentQuest) {
            if (this.currentQuest.type === QuestObjective.KILL_AMOUNT && this.playerQuest.qty >= this.currentQuest.quantity && this.playerQuest.status === 0) {
                return true;
            }
        }
        return false;
    }
}
