import { Callbacks } from "@colyseus/sdk";

// Callbacks.get() installs the decoder's change strategy. Reuse one strategy
// per room so UI/entity controllers cannot replace each other's dispatcher.
const callbackStrategies = new WeakMap<object, ReturnType<typeof Callbacks.get>>();

export function getRoomCallbacks(room: object): any {
    let callbacks = callbackStrategies.get(room);
    if (!callbacks) {
        callbacks = Callbacks.get(room as any);
        callbackStrategies.set(room, callbacks);
    }
    return callbacks;
}
