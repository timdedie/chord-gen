/**
 * In-memory cache for repeatable generation requests.
 *
 * Popular prompts ("sad lofi", "epic trailer") are requested constantly and
 * previously hit the model every time. This is per-instance and lossy by
 * design — a miss is just a normal generation, so there is nothing to
 * invalidate and no correctness risk.
 *
 * Only first-round requests are cacheable. Anything carrying feedback or
 * history belongs to one user's session and must not be shared. And because
 * `generate-multiple` deliberately runs hot (temperature 1.2) so different
 * users see different options, `hitLimit` caps how often one entry may be
 * served before it is regenerated.
 */

interface Entry {
    value: unknown;
    expiresAt: number;
    hits: number;
}

const store = new Map<string, Entry>();

const MAX_ENTRIES = 500;
const DEFAULT_TTL_MS = 10 * 60 * 1000;
/** How many times one cached result may be served before it is regenerated. */
const DEFAULT_HIT_LIMIT = 3;

export function cacheKey(parts: Array<string | number | boolean | undefined>): string {
    // An explicit separator that cannot occur in a prompt, so ["a b", "c"] and
    // ["a", "b c"] cannot collide on the same key.
    return parts.map((part) => String(part ?? "")).join("\u0000");
}

export function readCache<T>(key: string, hitLimit = DEFAULT_HIT_LIMIT): T | null {
    const entry = store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt || entry.hits >= hitLimit) {
        store.delete(key);
        return null;
    }

    entry.hits += 1;
    return entry.value as T;
}

export function writeCache(key: string, value: unknown, ttlMs = DEFAULT_TTL_MS): void {
    // Cheap bound: drop the oldest insertion when full. Map preserves insertion order.
    if (store.size >= MAX_ENTRIES) {
        const oldest = store.keys().next();
        if (!oldest.done) store.delete(oldest.value);
    }

    store.set(key, { value, expiresAt: Date.now() + ttlMs, hits: 0 });
}
