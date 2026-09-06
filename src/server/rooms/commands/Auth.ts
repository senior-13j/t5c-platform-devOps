import Logger from "../../utils/Logger";

class Auth {
    static async check(db, authData, expectedLocation?: string) {
        const token = typeof authData?.token === "string" ? authData.token.trim() : "";
        const rawCharacterId = authData?.character_id;
        const characterId =
            typeof rawCharacterId === "number"
                ? rawCharacterId
                : typeof rawCharacterId === "string" && /^\d+$/.test(rawCharacterId.trim())
                  ? Number(rawCharacterId)
                  : Number.NaN;

        if (!token || !Number.isSafeInteger(characterId) || characterId <= 0) {
            Logger.warning("[gameroom][onAuth] invalid authentication payload.");
            return false;
        }

        try {
            const user = await db.getUserByToken(token);
            if (!user) {
                Logger.warning("[gameroom][onAuth] invalid token.");
                return false;
            }

            const character = await db.getCharacter(characterId);
            if (!character || Number(character.user_id) !== Number(user.id)) {
                Logger.warning("[gameroom][onAuth] character not found or not owned by user.");
                return false;
            }

            if (expectedLocation && character.location !== expectedLocation) {
                Logger.warning("[gameroom][onAuth] character location does not match the requested room.");
                return false;
            }

            // Keep the database flag as a durable secondary guard. GameRoom
            // performs the atomic process-local reservation after this check.
            if (Number(character.online) > 0) {
                Logger.warning("[gameroom][onAuth] character already connected.");
                return false;
            }

            Logger.info("[gameroom][onAuth] client authenticated.");
            return character;
        } catch (error) {
            Logger.error("[gameroom][onAuth] authentication failed.", error);
            return false;
        }
    }
}

export { Auth };
