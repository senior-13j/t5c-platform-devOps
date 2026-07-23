import { Scene } from "@babylonjs/core/scene";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import type { IKeyboardEvent } from "@babylonjs/core/Events/deviceInputEvents";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { ServerMsg } from "../../shared/types";
import { isLocal } from "../Utils";
import { GameController } from "./GameController";
import { UserInterface } from "./UserInterface";
import { GameScene } from "../Screens/GameScene";
import { TouchControls } from "./TouchControls";
import type { TranslationKey } from "../i18n";

const MOVEMENT_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);

export class PlayerInput {
    private _gameScene: GameScene;
    private _scene: Scene;
    private _game: GameController;
    private _ui: UserInterface;
    private pressedMovementKeys = new Set<string>();
    private touchLookPointerId: number | null = null;
    private touchLookPosition = { x: 0, y: 0 };
    private movementInput = { x: 0, y: 0 };
    private touchControls?: TouchControls;
    private controlHintTimer?: number;
    private readonly handleWindowBlur = () => this.suspendMovement();
    private readonly handleVisibilityChange = () => {
        if (document.hidden) {
            this.suspendMovement();
        }
    };
    private readonly preventContextMenu = (event: Event) => event.preventDefault();

    public angle: number = 0;
    public horizontal: number = 0;
    public vertical: number = 0;

    public top_arrow: boolean = false;
    public down_arrow: boolean = false;
    public left_arrow: boolean = false;
    public right_arrow: boolean = false;

    public left_click: boolean = false;
    public right_click: boolean = false;
    public middle_click: boolean = false;
    public mouse_moving: boolean = false;
    public left_alt_pressed: boolean = false;
    public keyboard_c: boolean = false;
    public player_can_move: boolean = false;
    public digit_pressed: number = 0;
    public movementX: number = 0;
    public movementY: number = 0;

    constructor(gameScene: GameScene) {
        this._gameScene = gameScene;
        this._game = gameScene._game;
        this._scene = gameScene._scene;
        this._ui = gameScene._ui;

        this.bindPointerInput();
        this.bindKeyboardInput();
        this.bindLifecycleEvents();
        this.showControlHint();

        if (this._game.controlMode === "touch") {
            this.touchControls = new TouchControls(gameScene, this);
        }
    }

    public setTouchMovement(x: number, y: number): void {
        if (this._game.controlMode !== "touch") {
            return;
        }
        this.setMovementInput(x, y);
    }

    public refreshMovementDirection(): void {
        this.applyScreenMovement(this.movementInput.x, this.movementInput.y);
    }

    public suspendMovement(): void {
        this.pressedMovementKeys.clear();
        this.movementInput = { x: 0, y: 0 };
        this.stopMovement();
        this.touchControls?.reset();
    }

    public consumeCameraMovement(): { x: number; y: number } {
        const movement = { x: this.movementX, y: this.movementY };
        this.movementX = 0;
        this.movementY = 0;
        return movement;
    }

    private bindPointerInput(): void {
        this._scene.onPointerObservable.add((pointerInfo) => {
            const event = pointerInfo.event as PointerEvent;
            const isTouch = event.pointerType === "touch";

            if (isTouch && this._game.controlMode === "touch") {
                this.processTouchLook(pointerInfo.type, event);
                return;
            }

            if (this._game.controlMode !== "keyboard") {
                return;
            }

            if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
                if (event.button === 0) {
                    this.left_click = true;
                }
                if (event.button === 1 || event.button === 2) {
                    this.middle_click = true;
                    this.right_click = event.button === 2;
                }
            }

            if (pointerInfo.type === PointerEventTypes.POINTERUP) {
                if (event.button === 0) {
                    this.left_click = false;
                }
                if (event.button === 1 || event.button === 2) {
                    this.middle_click = false;
                    this.right_click = false;
                    this.mouse_moving = false;
                    this.consumeCameraMovement();
                }
            }

            if (pointerInfo.type === PointerEventTypes.POINTERMOVE && this.middle_click) {
                this.mouse_moving = true;
                this.movementX += event.movementX / 120;
                this.movementY += event.movementY / 100;
            }
        });
    }

    private processTouchLook(type: number, event: PointerEvent): void {
        if (type === PointerEventTypes.POINTERDOWN && this.touchLookPointerId === null) {
            this.touchLookPointerId = event.pointerId;
            this.touchLookPosition = { x: event.clientX, y: event.clientY };
            return;
        }

        if (event.pointerId !== this.touchLookPointerId) {
            return;
        }

        if (type === PointerEventTypes.POINTERMOVE) {
            const deltaX = event.clientX - this.touchLookPosition.x;
            const deltaY = event.clientY - this.touchLookPosition.y;
            if (Math.abs(deltaX) + Math.abs(deltaY) > 2) {
                this.middle_click = true;
                this.mouse_moving = true;
                this.movementX += deltaX / 180;
                this.movementY += deltaY / 150;
                this.touchLookPosition = { x: event.clientX, y: event.clientY };
            }
            return;
        }

        if (type === PointerEventTypes.POINTERUP) {
            this.touchLookPointerId = null;
            this.middle_click = false;
            this.mouse_moving = false;
            this.consumeCameraMovement();
        }
    }

    private bindKeyboardInput(): void {
        this._scene.onKeyboardObservable.add((keyboardInfo) => {
            const event = keyboardInfo.event;

            if (keyboardInfo.type === KeyboardEventTypes.KEYUP) {
                this.handleKeyUp(event);
                return;
            }

            if (keyboardInfo.type !== KeyboardEventTypes.KEYDOWN) {
                return;
            }

            if (this._game.controlMode !== "keyboard") {
                return;
            }

            if (MOVEMENT_KEYS.has(event.code)) {
                if (this._game.controlMode === "keyboard" && !this.isTyping()) {
                    event.preventDefault();
                    this.pressedMovementKeys.add(event.code);
                    this.updateKeyboardMovement();
                }
                return;
            }

            if (this.isTyping()) {
                return;
            }

            if (event.code === "Enter") {
                this.suspendMovement();
                event.preventDefault();
                window.setTimeout(() => this._ui._ChatBox?.focus(), 0);
                return;
            }

            if ((event as IKeyboardEvent & { repeat?: boolean }).repeat) {
                return;
            }

            const digit = event.code.match(/^Digit([1-9])$/);
            if (digit) {
                this.digit_pressed = Number(digit[1]);
                event.preventDefault();
                return;
            }

            if (isLocal() && event.altKey && event.shiftKey) {
                this.processDebugHotkey(event.code);
                event.preventDefault();
                return;
            }

            const panelHotkeys: Record<string, string> = {
                KeyI: "inventory",
                KeyJ: "quests",
                KeyK: "abilities",
                KeyC: "character",
                KeyH: "help",
            };
            if (panelHotkeys[event.code]) {
                this._ui._MainMenu?.openPanel(panelHotkeys[event.code]);
                event.preventDefault();
                return;
            }

            if (event.code === "KeyE") {
                this._gameScene._currentPlayer?.interactWithNearest();
                event.preventDefault();
                return;
            }

            if (event.code === "Tab") {
                this._gameScene._currentPlayer?.selectNearestTarget();
                event.preventDefault();
                return;
            }

            if (event.code === "Escape") {
                this._ui.closeActivePanels();
                event.preventDefault();
                return;
            }

            if (event.code === "Home") {
                this._ui._MainMenu?.takeScreenshot();
                event.preventDefault();
                return;
            }

            if (event.code === "ControlLeft" || event.code === "ControlRight") {
                this.left_alt_pressed = true;
            }

        });
    }

    private handleKeyUp(event: IKeyboardEvent): void {
        if (MOVEMENT_KEYS.has(event.code)) {
            this.pressedMovementKeys.delete(event.code);
            this.updateKeyboardMovement();
        }

        if (event.code === "KeyC") {
            this.keyboard_c = false;
        }

        if (event.code === "ControlLeft" || event.code === "ControlRight") {
            this.left_alt_pressed = false;
        }
    }

    private updateKeyboardMovement(): void {
        if (this._game.controlMode !== "keyboard" || this.isTyping()) {
            this.movementInput = { x: 0, y: 0 };
            this.stopMovement();
            return;
        }

        const x =
            Number(this.pressedMovementKeys.has("KeyD") || this.pressedMovementKeys.has("ArrowRight")) -
            Number(this.pressedMovementKeys.has("KeyA") || this.pressedMovementKeys.has("ArrowLeft"));
        const y =
            Number(this.pressedMovementKeys.has("KeyS") || this.pressedMovementKeys.has("ArrowDown")) -
            Number(this.pressedMovementKeys.has("KeyW") || this.pressedMovementKeys.has("ArrowUp"));
        this.setMovementInput(x, y);
    }

    private setMovementInput(x: number, y: number): void {
        this.movementInput = { x, y };
        this.refreshMovementDirection();
    }

    private applyScreenMovement(x: number, y: number): void {
        const magnitude = Math.min(1, Math.hypot(x, y));
        if (magnitude < 0.08) {
            this.stopMovement();
            return;
        }

        const normalizedX = x / Math.hypot(x, y);
        const normalizedY = y / Math.hypot(x, y);
        this.angle = Math.atan2(normalizedX, normalizedY);
        this.vertical = -Math.cos(this.angle + Math.PI - this._game.deltaCamY) * magnitude;
        this.horizontal = Math.sin(this.angle + Math.PI - this._game.deltaCamY) * magnitude;
        this.player_can_move = true;
    }

    private stopMovement(): void {
        this.player_can_move = false;
        this.vertical = 0;
        this.horizontal = 0;
        this.angle = 0;
    }

    private isTyping(): boolean {
        const active = document.activeElement as HTMLElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
            return true;
        }
        return Boolean(this._ui._ChatBox?.isFocused());
    }

    private bindLifecycleEvents(): void {
        const canvas = this._game.engine.getRenderingCanvas();
        window.addEventListener("blur", this.handleWindowBlur);
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
        canvas?.addEventListener("contextmenu", this.preventContextMenu);

        this._scene.onDisposeObservable.addOnce(() => {
            window.removeEventListener("blur", this.handleWindowBlur);
            document.removeEventListener("visibilitychange", this.handleVisibilityChange);
            canvas?.removeEventListener("contextmenu", this.preventContextMenu);
            if (this.controlHintTimer) {
                window.clearTimeout(this.controlHintTimer);
            }
            this.suspendMovement();
        });
    }

    private processDebugHotkey(code: string): void {
        if (code === "KeyJ") {
            this._game.sendMessage(ServerMsg.DEBUG_REMOVE_ENTITIES);
        }
        if (code === "Equal") {
            this._game.sendMessage(ServerMsg.DEBUG_INCREASE_ENTITIES);
        }
        if (code === "Minus") {
            this._game.sendMessage(ServerMsg.DEBUG_DECREASE_ENTITIES);
        }
        if (code === "Enter") {
            this._game.sendMessage(ServerMsg.DEBUG_BOTS);
        }
        if (code === "KeyN" && this._gameScene._navMeshDebug) {
            this._gameScene._navMeshDebug.isVisible = !this._gameScene._navMeshDebug.isVisible;
        }
        if (code === "KeyD" && this._ui._DebugBox?._debugPanel) {
            this._ui._DebugBox._debugPanel.isVisible = !this._ui._DebugBox._debugPanel.isVisible;
        }
        if (code === "KeyH") {
            const assetKey = "ENV_" + this._game.currentLocationKey;
            const allMeshes = this._game._loadedAssets[assetKey];
            if (allMeshes?.loadedMeshes) {
                const isVisible = !allMeshes.loadedMeshes[0].isVisible;
                allMeshes.loadedMeshes.forEach((mesh: Mesh) => {
                    mesh.isVisible = isVisible;
                });
            }
        }
    }

    private showControlHint(): void {
        const hint = document.getElementById("controlHint");
        const title = document.getElementById("controlHintTitle");
        const body = document.getElementById("controlHintBody");
        const dismiss = document.getElementById("controlHintDismiss") as HTMLButtonElement;
        if (!hint || !title || !body || !dismiss) {
            return;
        }

        const storageKey = `t5c_control_hint_${this._game.controlMode}_${this._game.locale}`;
        if (this.isHintDismissed(storageKey)) {
            return;
        }

        const titleKey: TranslationKey = this._game.controlMode === "touch" ? "hint.touch.title" : "hint.keyboard.title";
        const bodyKey: TranslationKey = this._game.controlMode === "touch" ? "hint.touch.body" : "hint.keyboard.body";
        title.textContent = this._game.t(titleKey);
        body.textContent = this._game.t(bodyKey);
        dismiss.setAttribute("aria-label", this._game.t("hint.dismiss"));
        dismiss.title = this._game.t("hint.dismiss");
        dismiss.onclick = () => {
            hint.hidden = true;
            this.rememberHintDismissal(storageKey);
            this._game.engine.getRenderingCanvas()?.focus();
        };
        hint.hidden = false;
        this.controlHintTimer = window.setTimeout(() => {
            hint.hidden = true;
            this.rememberHintDismissal(storageKey);
        }, 12000);
    }

    private isHintDismissed(storageKey: string): boolean {
        try {
            return sessionStorage.getItem(storageKey) === "dismissed";
        } catch {
            return false;
        }
    }

    private rememberHintDismissal(storageKey: string): void {
        try {
            sessionStorage.setItem(storageKey, "dismissed");
        } catch {
            // The hint can still be dismissed when session storage is unavailable.
        }
    }
}
