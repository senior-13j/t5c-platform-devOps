// colyseus
import { Client } from "@colyseus/sdk";
import { websocketUrl } from "../Utils";
import { ServerMsg } from "../../shared/types";

export class Network {
    public _client: Client;

    constructor(port) {
        // create colyseus client
        this._client = new Client(websocketUrl(port));
    }

    public async joinChatRoom(data): Promise<any> {
        return await this._client.joinOrCreate("chat_room", data);
    }

    public async joinOrCreateRoom(location, token, character_id): Promise<any> {
        // Matchmaking happens server-side. The room handler filters by the
        // requested location, so clients never need the public room listing.
        return await this._client.joinOrCreate("game_room", {
            location: location,
            token: token,
            character_id: character_id,
        });
    }
}
