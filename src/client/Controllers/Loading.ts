import { PreferencesController } from "./PreferencesController";

interface ILoadingScreen {
    displayLoadingUI: () => void;
    hideLoadingUI: () => void;
    loadingUIBackgroundColor: string;
    loadingUIText: string;
}

class Loading implements ILoadingScreen {
    public loadingUIBackgroundColor: string;
    public loadingUIText: string;
    public loadingScreenDiv: HTMLElement;
    public loadingScreenTxt: HTMLElement;
    public loadingTextDetailsTxt: HTMLElement;

    private loadingProgress: HTMLElement;
    private loadingProgressBar: HTMLElement;
    private fatalError: HTMLElement;
    private fatalErrorMessage: HTMLElement;
    private announcements: HTMLElement;

    constructor(private preferences: PreferencesController) {
        this.loadingUIText = this.preferences.t("loading.title");
        this.loadingScreenDiv = window.document.getElementById("loadingScreen");
        this.loadingScreenTxt = window.document.getElementById("loadingText");
        this.loadingTextDetailsTxt = window.document.getElementById("loadingTextDetails");
        this.loadingProgress = window.document.getElementById("loadingProgress");
        this.loadingProgressBar = window.document.getElementById("loadingProgressBar");
        this.fatalError = window.document.getElementById("fatalError");
        this.fatalErrorMessage = window.document.getElementById("fatalErrorMessage");
        this.announcements = window.document.getElementById("gameAnnouncements");

        window.document.getElementById("retryButton")?.addEventListener("click", () => window.location.reload());
    }

    public displayLoadingUI() {
        this.preferences.applyDocumentTranslations();
        this.fatalError.hidden = true;
        this.loadingScreenDiv.hidden = false;
        this.loadingScreenDiv.style.display = "grid";
        this.loadingScreenTxt.textContent = this.loadingUIText;
        this.setProgress(0, this.preferences.t("loading.gameData"));
    }

    public hideLoadingUI() {
        this.loadingScreenDiv.style.display = "none";
        this.loadingScreenDiv.hidden = true;
        this.announce(this.preferences.t("loading.ready"));
    }

    public setProgress(value: number, details?: string) {
        const progress = Math.max(0, Math.min(100, Math.round(value)));
        this.loadingProgress.setAttribute("aria-valuenow", progress.toString());
        this.loadingProgressBar.style.width = progress + "%";
        if (details) {
            this.loadingTextDetailsTxt.textContent = details;
        }
    }

    public setDetails(details: string) {
        this.loadingTextDetailsTxt.textContent = details;
    }

    public showFatalError(error: unknown) {
        const rawMessage = error instanceof Error ? error.message : String(error || "Unknown startup error");
        const isWebGlError = /webgl|rendering context|engine/i.test(rawMessage);
        const message = this.preferences.t(isWebGlError ? "fatal.webgl" : "fatal.default");

        document.getElementById("entrySetupOverlay")?.setAttribute("hidden", "");
        this.loadingScreenDiv.style.display = "none";
        this.loadingScreenDiv.hidden = true;
        this.fatalErrorMessage.textContent = message;
        this.fatalError.hidden = false;
        this.announce(this.preferences.t("fatal.announcement", { message }));
        window.document.getElementById("retryButton")?.focus();
    }

    private announce(message: string) {
        if (this.announcements) {
            this.announcements.textContent = message;
        }
    }
}

export { Loading, ILoadingScreen };
