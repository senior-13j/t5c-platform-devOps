import assert from "node:assert/strict";
import { test } from "node:test";
import { canCreateCharacter, characterCreationErrorKey } from "../src/client/Screens/characterCreation";
import { t } from "../src/client/i18n";
import { MAX_CHARACTERS_PER_USER } from "../src/shared/Config";

test("character creation closes exactly at the shared account limit", () => {
    assert.equal(canCreateCharacter(0), true);
    assert.equal(canCreateCharacter(MAX_CHARACTERS_PER_USER - 1), true);
    assert.equal(canCreateCharacter(MAX_CHARACTERS_PER_USER), false);
    assert.equal(canCreateCharacter(MAX_CHARACTERS_PER_USER + 1), false);
    assert.equal(canCreateCharacter(-1), false);
    assert.equal(canCreateCharacter(1.5), false);
});

test("character creation errors provide specific localized feedback", () => {
    assert.equal(characterCreationErrorKey(400), "editor.errorInvalid");
    assert.equal(characterCreationErrorKey(401), "editor.errorSession");
    assert.equal(characterCreationErrorKey(409), "editor.errorLimit");
    assert.equal(characterCreationErrorKey(429), "editor.errorRate");
    assert.equal(characterCreationErrorKey(500), "editor.errorGeneric");
    assert.match(t("en", characterCreationErrorKey(409), { limit: MAX_CHARACTERS_PER_USER }), /maximum of 5/);
    assert.match(t("ru", characterCreationErrorKey(429)), /Слишком много попыток/);
});
