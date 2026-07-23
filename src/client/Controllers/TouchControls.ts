import type { PlayerInput } from "./PlayerInput";
import { GameScene } from "../Screens/GameScene";

export class TouchControls {
    private readonly root: HTMLElement | null;
    private readonly joystick: HTMLElement | null;
    private readonly thumb: HTMLElement | null;
    private readonly actionButtons: HTMLButtonElement[] = [];
    private activePointerId: number | null = null;

    constructor(
        private gameScene: GameScene,
        private input: PlayerInput
    ) {
        this.root = document.getElementById("touchControls");
        this.joystick = document.getElementById("touchJoystick");
        this.thumb = document.getElementById("touchJoystickThumb");

        if (!this.root || !this.joystick || !this.thumb) {
            return;
        }

        this.root.hidden = false;
        this.bindJoystick();
        this.bindActions();
        this.gameScene._scene.onDisposeObservable.addOnce(() => this.dispose());
    }

    public dispose(): void {
        this.reset();
        if (this.joystick) {
            this.joystick.onpointerdown = null;
            this.joystick.onpointermove = null;
            this.joystick.onpointerup = null;
            this.joystick.onpointercancel = null;
            this.joystick.onlostpointercapture = null;
        }
        this.actionButtons.forEach((button) => (button.onclick = null));
        this.actionButtons.length = 0;
        if (this.root) {
            this.root.hidden = true;
        }
    }

    public reset(): void {
        this.activePointerId = null;
        this.input.setTouchMovement(0, 0);
        if (this.thumb) {
            this.thumb.style.transform = "translate(-50%, -50%)";
        }
    }

    private bindJoystick(): void {
        this.joystick.onpointerdown = (event) => {
            event.preventDefault();
            this.activePointerId = event.pointerId;
            this.joystick.setPointerCapture(event.pointerId);
            this.updateJoystick(event);
        };

        this.joystick.onpointermove = (event) => {
            if (event.pointerId !== this.activePointerId) {
                return;
            }
            event.preventDefault();
            this.updateJoystick(event);
        };

        const release = (event: PointerEvent) => {
            if (event.pointerId !== this.activePointerId) {
                return;
            }
            this.activePointerId = null;
            this.input.setTouchMovement(0, 0);
            this.thumb.style.transform = "translate(-50%, -50%)";
        };

        this.joystick.onpointerup = release;
        this.joystick.onpointercancel = release;
        this.joystick.onlostpointercapture = release;
    }

    private bindActions(): void {
        this.bindButton("touchInteractButton", () => this.gameScene._currentPlayer?.interactWithNearest());
        this.bindButton("touchTargetButton", () => this.gameScene._currentPlayer?.selectNearestTarget());
        this.bindButton("touchChatButton", () => this.gameScene._ui?.toggleChat());
        this.bindButton("touchZoomInButton", () => this.gameScene._currentPlayer?.cameraController.zoom(-1));
        this.bindButton("touchZoomOutButton", () => this.gameScene._currentPlayer?.cameraController.zoom(1));
    }

    private bindButton(id: string, action: () => void): void {
        const button = document.getElementById(id) as HTMLButtonElement;
        if (!button) {
            return;
        }
        this.actionButtons.push(button);
        button.onclick = (event) => {
            event.preventDefault();
            action();
        };
    }

    private updateJoystick(event: PointerEvent): void {
        const rect = this.joystick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const maxDistance = rect.width * 0.36;
        const rawX = event.clientX - centerX;
        const rawY = event.clientY - centerY;
        const distance = Math.hypot(rawX, rawY);
        const scale = distance > maxDistance ? maxDistance / distance : 1;
        const offsetX = rawX * scale;
        const offsetY = rawY * scale;

        this.thumb.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`;
        this.input.setTouchMovement(offsetX / maxDistance, offsetY / maxDistance);
    }
}
