import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";

import { GameController } from "../Controllers/GameController";
import State from "./Screens";

export class LoginScene {
    private _game: GameController;
    public _scene: Scene;

    async createScene(game: GameController): Promise<void> {
        this._game = game;
        this._scene = new Scene(this._game.engine);
        this._scene.clearColor = new Color4(0.06, 0.09, 0.08, 1);

        const camera = new FreeCamera("loginCamera", Vector3.Zero(), this._scene);
        camera.setTarget(Vector3.Zero());

        this.showLoginOverlay();
        this._game.engine.hideLoadingUI();
    }

    private showLoginOverlay() {
        const overlay = document.getElementById("loginOverlay");
        const form = document.getElementById("loginForm") as HTMLFormElement;
        const usernameInput = document.getElementById("usernameInput") as HTMLInputElement;
        const passwordInput = document.getElementById("passwordInput") as HTMLInputElement;
        const loginButton = document.getElementById("loginButton") as HTMLButtonElement;
        const quickPlayButton = document.getElementById("quickPlayButton") as HTMLButtonElement;
        const feedback = document.getElementById("loginFeedback");

        this._game.preferences.applyDocumentTranslations();
        document.getElementById("loginVersion").textContent = this._game.t("login.version", {
            version: this._game.config.version,
        });
        overlay.hidden = false;
        feedback.textContent = "";

        const setBusy = (busy: boolean, message = "") => {
            loginButton.disabled = busy;
            quickPlayButton.disabled = busy;
            loginButton.textContent = this._game.t(busy ? "login.connecting" : "login.connect");
            feedback.textContent = message;
        };

        form.onsubmit = async (event) => {
            event.preventDefault();
            if (!form.reportValidity()) {
                return;
            }

            setBusy(true, this._game.t("login.checking"));
            const loginResult = await this._game.login(usernameInput.value.trim(), passwordInput.value);

            if (loginResult) {
                form.reset();
                overlay.hidden = true;
                this._game.setScene(State.CHARACTER_SELECTION);
                return;
            }

            setBusy(false, this._game.latestError || this._game.t("login.error"));
            passwordInput.focus();
            passwordInput.select();
        };

        quickPlayButton.onclick = () => {
            setBusy(true, this._game.t("login.quickCreating"));
            overlay.hidden = true;
            this._game.setScene(State.CHARACTER_SELECTION);
        };

        if (this._game.controlMode === "keyboard") {
            window.requestAnimationFrame(() => usernameInput.focus());
        }
    }
}
