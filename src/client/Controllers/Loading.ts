interface ILoadingScreen {
    displayLoadingUI: () => void;
    hideLoadingUI: () => void;
    loadingUIBackgroundColor: string;
    loadingUIText: string;
}

class Loading implements ILoadingScreen {
    public loadingUIBackgroundColor: string;
    public loadingScreenDiv: HTMLElement;
    public loadingScreenTxt: HTMLElement;
    public loadingTextDetailsTxt: HTMLElement;

    private loadingProgress: HTMLElement;
    private loadingProgressBar: HTMLElement;
    private fatalError: HTMLElement;
    private fatalErrorMessage: HTMLElement;
    private announcements: HTMLElement;

    constructor(public loadingUIText: string) {
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
        this.fatalError.hidden = true;
        this.loadingScreenDiv.style.display = "grid";
        this.loadingScreenTxt.textContent = this.loadingUIText;
        this.setProgress(0, "Loading game data...");
    }

    public hideLoadingUI() {
        this.loadingScreenDiv.style.display = "none";
        this.announce("T5C is ready to play.");
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
        const message = isWebGlError
            ? "This browser could not create a WebGL graphics context. Enable hardware acceleration or try a current browser and reload the game."
            : "The game could not finish loading. Check your connection and reload; if the problem continues, open technical help.";

        this.loadingScreenDiv.style.display = "none";
        this.fatalErrorMessage.textContent = message;
        this.fatalError.hidden = false;
        this.announce("T5C could not start. " + message);
        window.document.getElementById("retryButton")?.focus();
    }

    private announce(message: string) {
        if (this.announcements) {
            this.announcements.textContent = message;
        }
    }
}

export { Loading, ILoadingScreen };
