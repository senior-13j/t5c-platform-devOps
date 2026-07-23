import { ControlMode, Locale, TranslationKey, TranslationParams, t } from "../i18n";

const LOCALE_STORAGE_KEY = "t5c_locale";
const CONTROL_STORAGE_KEY = "t5c_control_mode";

export class PreferencesController {
    public locale: Locale;
    public controlMode: ControlMode;

    private readonly recommendedControlMode: ControlMode;

    constructor() {
        this.recommendedControlMode = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 700 ? "touch" : "keyboard";
        this.locale = this.readLocale();
        this.controlMode = this.readControlMode();
        this.applyDocumentTranslations();
    }

    public t(key: TranslationKey, params: TranslationParams = {}): string {
        return t(this.locale, key, params);
    }

    public async requestEntrySelection(): Promise<void> {
        const overlay = document.getElementById("entrySetupOverlay");
        const form = document.getElementById("entrySetupForm") as HTMLFormElement;
        if (!overlay || !form) {
            return;
        }

        const localeInput = form.querySelector<HTMLInputElement>(`input[name="locale"][value="${this.locale}"]`);
        const controlInput = form.querySelector<HTMLInputElement>(`input[name="controlMode"][value="${this.controlMode}"]`);
        if (localeInput) {
            localeInput.checked = true;
        }
        if (controlInput) {
            controlInput.checked = true;
        }

        this.updateRecommendationBadges();
        this.applyDocumentTranslations();
        overlay.hidden = false;

        await new Promise<void>((resolve) => {
            form.onchange = (event) => {
                const input = event.target as HTMLInputElement;
                if (input.name === "locale" && (input.value === "en" || input.value === "ru")) {
                    this.locale = input.value;
                    this.applyDocumentTranslations();
                }
                if (input.name === "controlMode" && (input.value === "keyboard" || input.value === "touch")) {
                    this.controlMode = input.value;
                    this.applyDocumentTranslations();
                }
            };

            form.onsubmit = (event) => {
                event.preventDefault();
                const data = new FormData(form);
                const locale = data.get("locale");
                const controlMode = data.get("controlMode");
                if (locale === "en" || locale === "ru") {
                    this.locale = locale;
                }
                if (controlMode === "keyboard" || controlMode === "touch") {
                    this.controlMode = controlMode;
                }
                this.persist();
                this.applyDocumentTranslations();
                overlay.hidden = true;
                resolve();
            };
        });
    }

    public applyDocumentTranslations(): void {
        document.documentElement.lang = this.locale;
        document.body?.setAttribute("data-control-mode", this.controlMode);
        document.title = this.t("meta.title");

        const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (description) {
            description.content = this.t("meta.description");
        }
        document.querySelectorAll<HTMLMetaElement>('meta[property="og:title"], meta[name="twitter:title"]').forEach((meta) => {
            meta.content = this.t("meta.title");
        });
        document
            .querySelectorAll<HTMLMetaElement>('meta[property="og:description"], meta[name="twitter:description"]')
            .forEach((meta) => {
                meta.content = this.t("meta.description");
            });

        document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
            const key = element.dataset.i18n as TranslationKey;
            element.textContent = this.t(key);
        });
        document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((element) => {
            const key = element.dataset.i18nAriaLabel as TranslationKey;
            element.setAttribute("aria-label", this.t(key));
        });
        document.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((element) => {
            const key = element.dataset.i18nTitle as TranslationKey;
            element.setAttribute("title", this.t(key));
        });

        const instructions = document.getElementById("gameInstructionsText");
        if (instructions) {
            instructions.textContent = this.t(
                this.controlMode === "touch" ? "a11y.controls.touch" : "a11y.controls.keyboard"
            );
        }

        this.updateRecommendationBadges();
    }

    private updateRecommendationBadges(): void {
        document.querySelectorAll<HTMLElement>("[data-recommended-mode]").forEach((badge) => {
            badge.hidden = badge.dataset.recommendedMode !== this.recommendedControlMode;
        });
    }

    private persist(): void {
        try {
            localStorage.setItem(LOCALE_STORAGE_KEY, this.locale);
            localStorage.setItem(CONTROL_STORAGE_KEY, this.controlMode);
        } catch (error) {
            console.warn("[PREFERENCES] Unable to persist browser preferences", error);
        }
    }

    private readLocale(): Locale {
        try {
            const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
            if (stored === "en" || stored === "ru") {
                return stored;
            }
        } catch (error) {
            console.warn("[PREFERENCES] Unable to read the stored locale", error);
        }
        return navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
    }

    private readControlMode(): ControlMode {
        try {
            const stored = localStorage.getItem(CONTROL_STORAGE_KEY);
            if (stored === "keyboard" || stored === "touch") {
                return stored;
            }
        } catch (error) {
            console.warn("[PREFERENCES] Unable to read the stored control mode", error);
        }
        return this.recommendedControlMode;
    }
}
