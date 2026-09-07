export function getOwnDataEntry<T>(collection: unknown, key: unknown): T | false {
    if (
        typeof key !== "string" ||
        key.length === 0 ||
        collection === null ||
        typeof collection !== "object" ||
        !Object.prototype.hasOwnProperty.call(collection, key)
    ) {
        return false;
    }

    return ((collection as Record<string, T | null | undefined>)[key] ?? false) as T | false;
}
