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

const MOVEMENT_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);
const ONBOARDING_STORAGE_KEY = "arkadii_quest_onboarding_v1_seen";
const TUTORIAL_STORAGE_KEY = "arkadii_quest_tutorial_v1_progress";
type TutorialAction = "move" | "combat" | "explore";

export class PlayerInput {
    private _gameScene: GameScene;
    private _scene: Scene;
    private _game: GameController;
    private _ui: UserInterface;
    private pressedMovementKeys = new Set<string>();
    private movementInput = { x: 0, y: 0 };
    private touchControls?: TouchControls;
    private tutorialProgress = new Set<TutorialAction>();
    private guideIsBound = false;
    private focusBeforeGuide: HTMLElement | null = null;
    private readonly handleWindowBlur = () => this.suspendMovement();
    private readonly handleVisibilityChange = () => {
        if (document.hidden) {
            this.suspendMovement();
        }
    };
    private readonly preventContextMenu = (event: Event) => event.preventDefault();
    private readonly handleGuideShortcut = (event: KeyboardEvent) => {
        if (event.code === "F1") {
            if (event.repeat) {
                return;
            }
            event.preventDefault();
            this.toggleOnboarding();
            return;
        }
        if (event.code === "Escape" && this.isOnboardingOpen()) {
            event.preventDefault();
            this.closeOnboarding(true);
            return;
        }
        if (event.code === "Tab" && this.isOnboardingOpen()) {
            const overlay = document.getElementById("onboardingOverlay");
            const focusable = Array.from(
                overlay?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []
            ).filter((element) => !element.hidden);
            if (!focusable.length) {
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
            }
        }
    };

    public angle: number = 0;
    public horizontal: number = 0;
    public vertical: number = 0;

    public left_click: boolean = false;
    public player_can_move: boolean = false;
    public digit_pressed: number = 0;

    constructor(gameScene: GameScene) {
        this._gameScene = gameScene;
        this._game = gameScene._game;
        this._scene = gameScene._scene;
        this._ui = gameScene._ui;

        this.bindPointerInput();
        this.bindKeyboardInput();
        this.bindLifecycleEvents();
        this.restoreTutorialProgress();

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

    public suspendMovement(): void {
        this.pressedMovementKeys.clear();
        this.movementInput = { x: 0, y: 0 };
        this.stopMovement();
        this.touchControls?.reset();
    }

    private bindPointerInput(): void {
        this._scene.onPointerObservable.add((pointerInfo) => {
            const event = pointerInfo.event as PointerEvent;
            if (this.isOnboardingOpen()) {
                return;
            }

            if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
                if (event.button === 0) {
                    this.left_click = true;
                }
            }

            if (pointerInfo.type === PointerEventTypes.POINTERUP) {
                if (event.button === 0) {
                    this.left_click = false;
                }
            }
        });
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

            if (this.isOnboardingOpen()) {
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
                this.recordTutorialAction("explore");
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
                this.recordTutorialAction("combat");
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
                this.recordTutorialAction("explore");
                event.preventDefault();
                return;
            }

            if (event.code === "KeyE") {
                this._gameScene._currentPlayer?.interactWithNearest();
                this.recordTutorialAction("explore");
                event.preventDefault();
                return;
            }

            if (event.code === "Tab") {
                this._gameScene._currentPlayer?.selectNearestTarget();
                this.recordTutorialAction("combat");
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

        });
    }

    private handleKeyUp(event: IKeyboardEvent): void {
        if (MOVEMENT_KEYS.has(event.code)) {
            this.pressedMovementKeys.delete(event.code);
            this.updateKeyboardMovement();
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
        this.applyScreenMovement(x, y);
        if (Math.hypot(x, y) >= 0.08) {
            this.recordTutorialAction("move");
        }
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
        window.addEventListener("keydown", this.handleGuideShortcut);
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
        canvas?.addEventListener("contextmenu", this.preventContextMenu);

        this._scene.onDisposeObservable.addOnce(() => {
            window.removeEventListener("blur", this.handleWindowBlur);
            window.removeEventListener("keydown", this.handleGuideShortcut);
            document.removeEventListener("visibilitychange", this.handleVisibilityChange);
            canvas?.removeEventListener("contextmenu", this.preventContextMenu);
            this.unbindOnboarding();
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

    public showOnboarding(): void {
        this.bindOnboarding();
        const quickGuide = document.getElementById("quickGuideButton");
        if (quickGuide) {
            quickGuide.hidden = false;
        }
        this.updateTutorialProgress();

        try {
            if (localStorage.getItem(ONBOARDING_STORAGE_KEY) === "seen") {
                return;
            }
        } catch {
            // The first-run guide still opens when storage is unavailable.
        }
        this.openOnboarding();
    }

    public recordTutorialAction(action: TutorialAction): void {
        if (this.tutorialProgress.has(action)) {
            return;
        }
        this.tutorialProgress.add(action);
        this.persistTutorialProgress();
        this.updateTutorialProgress();
    }

    private bindOnboarding(): void {
        if (this.guideIsBound) {
            return;
        }
        const quickGuide = document.getElementById("quickGuideButton") as HTMLButtonElement;
        const close = document.getElementById("onboardingClose") as HTMLButtonElement;
        const later = document.getElementById("onboardingLater") as HTMLButtonElement;
        const start = document.getElementById("onboardingStart") as HTMLButtonElement;
        if (!quickGuide || !close || !later || !start) {
            return;
        }
        quickGuide.onclick = () => this.openOnboarding();
        close.onclick = () => this.closeOnboarding(true);
        later.onclick = () => this.closeOnboarding(true);
        start.onclick = () => this.closeOnboarding(true);
        this.guideIsBound = true;
    }

    private unbindOnboarding(): void {
        ["quickGuideButton", "onboardingClose", "onboardingLater", "onboardingStart"].forEach((id) => {
            const button = document.getElementById(id) as HTMLButtonElement;
            if (button) {
                button.onclick = null;
            }
        });
        this.guideIsBound = false;
        this.closeOnboarding(false);
        document.getElementById("quickGuideButton")?.setAttribute("hidden", "");
    }

    private toggleOnboarding(): void {
        this.bindOnboarding();
        if (this.isOnboardingOpen()) {
            this.closeOnboarding(true);
        } else {
            this.openOnboarding();
        }
    }

    private openOnboarding(): void {
        const overlay = document.getElementById("onboardingOverlay");
        const quickGuide = document.getElementById("quickGuideButton");
        if (!overlay) {
            return;
        }
        if (!this.isOnboardingOpen()) {
            this.focusBeforeGuide = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }
        this.suspendMovement();
        this.updateTutorialProgress();
        overlay.hidden = false;
        if (quickGuide) {
            quickGuide.hidden = true;
        }
        document.body.classList.add("guide-open");
        window.setTimeout(() => (document.getElementById("onboardingStart") as HTMLButtonElement)?.focus(), 0);
    }

    private closeOnboarding(remember: boolean): void {
        const overlay = document.getElementById("onboardingOverlay");
        const quickGuide = document.getElementById("quickGuideButton");
        if (overlay) {
            overlay.hidden = true;
        }
        if (quickGuide && this._gameScene.playerIsSpawned) {
            quickGuide.hidden = false;
        }
        document.body.classList.remove("guide-open");
        if (remember) {
            try {
                localStorage.setItem(ONBOARDING_STORAGE_KEY, "seen");
            } catch {
                // The guide remains available via F1 when storage is unavailable.
            }
            if (this._game.controlMode === "keyboard") {
                const focusTarget = this.focusBeforeGuide?.isConnected
                    ? this.focusBeforeGuide
                    : this._game.engine.getRenderingCanvas();
                focusTarget?.focus();
            }
        }
        this.focusBeforeGuide = null;
    }

    private isOnboardingOpen(): boolean {
        const overlay = document.getElementById("onboardingOverlay");
        return Boolean(overlay && !overlay.hidden);
    }

    private restoreTutorialProgress(): void {
        try {
            const stored = JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY) ?? "[]");
            if (Array.isArray(stored)) {
                stored.forEach((action) => {
                    if (action === "move" || action === "combat" || action === "explore") {
                        this.tutorialProgress.add(action);
                    }
                });
            }
        } catch {
            this.tutorialProgress.clear();
        }
    }

    private persistTutorialProgress(): void {
        try {
            localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify([...this.tutorialProgress]));
        } catch {
            // Progress remains active for the current play session.
        }
    }

    private updateTutorialProgress(): void {
        document.querySelectorAll<HTMLElement>("[data-tutorial-step]").forEach((step) => {
            const action = step.dataset.tutorialStep as TutorialAction;
            const isComplete = this.tutorialProgress.has(action);
            step.classList.toggle("is-complete", isComplete);
        });
        const progress = document.getElementById("tutorialProgress");
        if (progress) {
            progress.textContent = `${this.tutorialProgress.size} / 3`;
        }
    }
}
