import { Note } from "tonal";

/**
 * Voicing checks, not voicing decisions.
 *
 * The model chooses the exact notes for every chord along with its symbol, and
 * it has full musical freedom over them: colour tones the symbol does not name
 * (a 9th on a Dm7, an added 6th, a cluster) are the point, not a mistake. The
 * symbol is the lead-sheet label; the notes are the performance. So nothing
 * here checks the notes against the harmony — only that they can actually be
 * played and shown on the keyboard.
 */

/** A chord symbol and the exact notes that realise it. */
export interface VoicedChord {
    symbol: string;
    /**
     * Pitched notes in scientific pitch notation (C4 = middle C), ascending.
     * `notes[0]` is the bass. Chosen by the model — nothing re-voices them.
     */
    notes: string[];
}

/**
 * The pitch range voicings must stay inside, and what the keyboard displays.
 * Anything reading this should read it rather than restate it.
 */
export const VOICED_RANGE = { low: "A1", high: "C7" } as const;

export const MIN_VOICING_NOTES = 2;
export const MAX_VOICING_NOTES = 10;

const LOWEST = Note.midi(VOICED_RANGE.low) as number;
const HIGHEST = Note.midi(VOICED_RANGE.high) as number;

export type VoicingResult =
    | { ok: true; notes: string[] }
    | { ok: false; error: string };

/** A letter, up to two accidentals, then an octave: "F#3", "Bb4", "C##2". */
const PITCHED_NOTE = /^[A-G](#{1,2}|b{1,2})?\d$/;

/**
 * Canonical spelling for a pitched note, or null when it is not one.
 *
 * Notes are respelled with at most one accidental and never as Cb/Fb/E#/B#:
 * the keyboard only lights up `[A-G][#b]?` and would silently drop the rest.
 * The pitch never changes.
 */
function normalizeNote(raw: string): string | null {
    const trimmed = raw.trim();
    const cased = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    if (!PITCHED_NOTE.test(cased)) return null;

    const simplified = Note.simplify(cased);
    return simplified && Note.midi(simplified) !== null ? simplified : null;
}

/**
 * Check that a model-chosen voicing is playable.
 *
 * On success the notes come back deduplicated, sorted low to high and
 * canonically spelled. Error messages are written to be sent back to the model
 * verbatim, so each one says what to change.
 */
export function validateVoicing(symbol: string, rawNotes: string[]): VoicingResult {
    const byMidi = new Map<number, string>();
    for (const raw of rawNotes) {
        const note = normalizeNote(String(raw));
        const midi = note ? Note.midi(note) : null;
        if (!note || midi === null) {
            return {
                ok: false,
                error: `${symbol}: "${raw}" is not a pitched note. Write a letter, an optional # or b, then an octave number — e.g. "F#3".`,
            };
        }
        byMidi.set(midi, note);
    }

    const notes = [...byMidi.entries()].sort(([a], [b]) => a - b).map(([, note]) => note);

    if (notes.length < MIN_VOICING_NOTES || notes.length > MAX_VOICING_NOTES) {
        return {
            ok: false,
            error: `${symbol}: use ${MIN_VOICING_NOTES}-${MAX_VOICING_NOTES} different notes (got ${notes.length}).`,
        };
    }

    const outOfRange = notes.filter((n) => {
        const midi = Note.midi(n) as number;
        return midi < LOWEST || midi > HIGHEST;
    });
    if (outOfRange.length) {
        return {
            ok: false,
            error: `${symbol}: ${outOfRange.join(", ")} is outside the playable range ${VOICED_RANGE.low}-${VOICED_RANGE.high}.`,
        };
    }

    return { ok: true, notes };
}

/**
 * Voiced chords read back from storage, which is untrusted: rows saved before
 * voicings existed have only `symbols`, and older formats kept the chords
 * under `slots`. Notes that no longer check out are dropped rather than
 * patched up, so those chords are silent — and the reason is logged.
 */
export function readStoredChords(raw: unknown, symbols: string[] = []): VoicedChord[] {
    const stored = Array.isArray(raw) ? raw : (raw as { slots?: unknown } | null)?.slots;

    if (!Array.isArray(stored)) {
        if (symbols.length) console.warn(`[voicing] no stored notes for ${symbols.join(" ")}.`);
        return symbols.map((symbol) => ({ symbol, notes: [] }));
    }

    return stored.flatMap((item): VoicedChord[] => {
        const { symbol, notes } = (item ?? {}) as { symbol?: unknown; notes?: unknown };
        if (typeof symbol !== "string" || !symbol.trim()) return [];

        if (!Array.isArray(notes)) {
            console.warn(`[voicing] ${symbol} has no stored notes.`);
            return [{ symbol, notes: [] }];
        }
        const checked = validateVoicing(symbol, notes.map(String));
        if (!checked.ok) console.warn(`[voicing] stored notes rejected — ${checked.error}`);
        return [{ symbol, notes: checked.ok ? checked.notes : [] }];
    });
}
