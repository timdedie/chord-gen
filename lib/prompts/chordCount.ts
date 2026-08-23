export const MIN_CHORDS = 2;
export const MAX_CHORDS = 8;

/** Number words we accept in feedback like "add two chords" or "six chords". */
const NUMBER_WORDS: Record<string, number> = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    couple: 2,
    few: 3,
};

const NUMBER_TOKEN = '\\d+|a|an|one|two|three|four|five|six|seven|eight|couple(?:\\s+of)?|few';

/** "add two more chords", "throw in a chord" */
const ADD_PATTERNS = [
    new RegExp(`\\b(?:add|append|insert|include|throw in|tack on|put in)\\s+(?:in\\s+)?(${NUMBER_TOKEN})?\\s*(?:more|extra|additional)?\\s*chords?\\b`, 'i'),
    new RegExp(`\\b(${NUMBER_TOKEN})\\s+(?:more|extra|additional)\\s+chords?\\b`, 'i'),
];

/** "remove a chord", "two fewer chords" */
const REMOVE_PATTERNS = [
    new RegExp(`\\b(?:remove|delete|drop|cut|lose|take out|take away)\\s+(${NUMBER_TOKEN})?\\s*chords?\\b`, 'i'),
    new RegExp(`\\b(${NUMBER_TOKEN})\\s+(?:fewer|less)\\s+chords?\\b`, 'i'),
];

/** "make it 6 chords", "a 3-chord progression", "only four chords" */
const ABSOLUTE_PATTERN = new RegExp(`\\b(\\d+|two|three|four|five|six|seven|eight)[-\\s]*chord(?:s|\\s+progression)?\\b`, 'i');

/**
 * Bare "shorter"/"longer" nudges the length by one — but not when it's clearly
 * about how the chords sound rather than how many there are.
 */
const SHORTER_PATTERN = /\b(shorter|briefer|more concise)\b/i;
const LONGER_PATTERN = /\b(longer|extend(?:ed)?|stretch(?:ed)? out)\b/i;
const DURATION_CONTEXT = /\b(notes?|sustain|hold|held|decay|release|tail|ring)\b/i;

function toNumber(token: string | undefined): number | undefined {
    if (!token) return undefined;
    const normalized = token.trim().toLowerCase().replace(/\s+of$/, '');
    if (/^\d+$/.test(normalized)) return parseInt(normalized, 10);
    return NUMBER_WORDS[normalized];
}

export function clampChordCount(value: number): number {
    return Math.min(MAX_CHORDS, Math.max(MIN_CHORDS, Math.round(value)));
}

function firstMatch(patterns: RegExp[], text: string): RegExpMatchArray | undefined {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match;
    }
    return undefined;
}

/**
 * Works out how many chords the next round should have, given the user's
 * feedback and the count they're on now.
 *
 * Feedback like "make it 6 chords" or "add one more" is a length change: the
 * old behaviour locked the schema to the previous count, so the model's
 * (correct) longer answer failed validation on every retry and the request
 * died. Relative phrasings are applied to `currentCount`; absolute ones win
 * outright. Anything we don't recognise leaves the count alone — the schema
 * stays tolerant for feedback rounds, so a phrasing we miss still generates.
 */
export function resolveChordCount(feedback: string | undefined, currentCount: number): number {
    const base = clampChordCount(currentCount);
    if (!feedback?.trim()) return base;

    const text = feedback.toLowerCase();

    // Relative first: "add 2 chords" also contains "2 chords".
    const added = firstMatch(ADD_PATTERNS, text);
    if (added) return clampChordCount(base + (toNumber(added[1]) ?? 1));

    const removed = firstMatch(REMOVE_PATTERNS, text);
    if (removed) return clampChordCount(base - (toNumber(removed[1]) ?? 1));

    const absolute = ABSOLUTE_PATTERN.exec(text);
    if (absolute) {
        const value = toNumber(absolute[1]);
        if (value !== undefined) return clampChordCount(value);
    }

    if (!DURATION_CONTEXT.test(text)) {
        if (SHORTER_PATTERN.test(text)) return clampChordCount(base - 1);
        if (LONGER_PATTERN.test(text)) return clampChordCount(base + 1);
    }

    return base;
}
