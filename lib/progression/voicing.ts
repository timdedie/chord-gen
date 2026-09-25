import { Chord, Interval, Note } from "tonal";

/**
 * Voicing checks, not voicing decisions.
 *
 * The model chooses the exact notes for every chord along with its symbol, so
 * voicing can follow the genre and the voice leading it had in mind instead of
 * being guessed back from the symbol afterwards. This module only makes sure
 * the two agree: every note belongs to the chord, the bass is the bass the
 * symbol names, and the tones that make the chord what it is are all there. A
 * voicing that fails is sent back to the model with the reason, never repaired
 * here.
 */

/**
 * The pitch range voicings must stay inside, and what the keyboard displays.
 * Anything reading this should read it rather than restate it.
 */
export const VOICED_RANGE = { low: "A1", high: "C6" } as const;

export const MIN_VOICING_NOTES = 3;
export const MAX_VOICING_NOTES = 8;

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

const chroma = (note: string) => Note.chroma(note);

/**
 * The chord above its bass. tonal spells a slash chord's intervals from the
 * bass (C/E is 3M 5P 8P), which hides which note is the 3rd and which the
 * root, so the analysis below reads the unslashed chord instead.
 */
function upperStructure(symbol: string) {
    const chord = Chord.get(symbol);
    if (!chord.bass) return chord;
    return Chord.get(symbol.slice(0, symbol.lastIndexOf("/")));
}

/** Extensions in their plain form — anything else is an alteration. */
const PLAIN_EXTENSIONS = new Set(["9M", "11P", "13M"]);

/**
 * The tones a voicing may not leave out: those that say which chord this is.
 *
 * A player drops the 5th first, because it carries no information, then the
 * root, because the bass already has it — so neither is required once the
 * chord has more than four tones. The 3rd (or the sus tone standing in for
 * it), the 6th or 7th, any altered tone and the highest named extension always
 * stay: without them Cmaj9 is just C, and C7b9 is just C7.
 */
function essentialTones(symbol: string): string[] {
    const chord = upperStructure(symbol);
    if (chord.empty || chord.notes.length !== chord.intervals.length) return [];
    if (chord.notes.length <= 2) return chord.notes;

    const tones = chord.notes.map((note, i) => {
        const interval = Interval.get(chord.intervals[i]);
        return { note, name: interval.name, num: interval.num ?? 0, quality: interval.q ?? "" };
    });

    const extensions = tones.filter((t) => t.num >= 9);
    const highest = extensions.length
        ? extensions.reduce((top, t) => (t.num > top.num ? t : top))
        : null;

    return tones
        .filter((t) =>
            (t.num === 1 && tones.length <= 4) ||
            t.num === 2 || t.num === 3 || t.num === 4 ||
            t.num === 6 || t.num === 7 ||
            (t.num === 5 && t.quality !== "P") ||
            (t.num >= 9 && !PLAIN_EXTENSIONS.has(t.name)) ||
            t === highest,
        )
        .map((t) => t.note);
}

const list = (notes: string[]) => notes.join(", ");

/**
 * Check a model-chosen voicing against its chord symbol.
 *
 * On success the notes come back deduplicated, sorted low to high and
 * canonically spelled. Error messages are written to be sent back to the model
 * verbatim, so each one says what to change.
 */
export function validateVoicing(symbol: string, rawNotes: string[]): VoicingResult {
    const chord = Chord.get(symbol);
    if (chord.empty || !chord.tonic) {
        return { ok: false, error: `"${symbol}" is not a recognizable chord symbol.` };
    }

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
            error: `${symbol}: ${list(outOfRange)} is outside the playable range ${VOICED_RANGE.low}-${VOICED_RANGE.high}.`,
        };
    }

    const allowed = new Set(chord.notes.map(chroma));
    const strays = notes.filter((n) => !allowed.has(chroma(n)));
    if (strays.length) {
        return {
            ok: false,
            error: `${symbol}: ${list(strays)} ${strays.length > 1 ? "are" : "is"} not in the chord (${chord.notes.join(" ")}). Use only chord tones, or change the symbol so it names the extra note.`,
        };
    }

    const bass = chord.bass || chord.tonic;
    if (chroma(notes[0]) !== chroma(bass)) {
        const actual = Note.pitchClass(notes[0]);
        const upper = chord.bass ? symbol.slice(0, symbol.lastIndexOf("/")) : symbol;
        return {
            ok: false,
            error: `${symbol}: the lowest note must be the bass, ${bass}, but it is ${notes[0]}. Put ${bass} at the bottom, or write the chord as ${upper}/${actual}.`,
        };
    }

    const present = new Set(notes.map(chroma));
    const missing = essentialTones(symbol).filter((pc) => !present.has(chroma(pc)));
    if (missing.length) {
        return {
            ok: false,
            error: `${symbol}: missing ${list(missing)} — without ${missing.length > 1 ? "them" : "it"} the notes do not spell ${symbol}.`,
        };
    }

    return { ok: true, notes };
}
