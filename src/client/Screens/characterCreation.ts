import { MAX_CHARACTERS_PER_USER } from "../../shared/Config";
import type { TranslationKey } from "../i18n";

export function canCreateCharacter(characterCount: number): boolean {
    return Number.isSafeInteger(characterCount) && characterCount >= 0 && characterCount < MAX_CHARACTERS_PER_USER;
}

export function characterCreationErrorKey(status?: number): TranslationKey {
    if (status === 409) {
        return "editor.errorLimit";
    }
    if (status === 429) {
        return "editor.errorRate";
    }
    if (status === 400) {
        return "editor.errorInvalid";
    }
    if (status === 401) {
        return "editor.errorSession";
    }
    return "editor.errorGeneric";
}
