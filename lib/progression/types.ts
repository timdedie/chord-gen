/**
 * The progression document model.
 *
 * A progression used to be a bare `string[]` of chord symbols, which left no
 * room for the things a real editor needs: a key to reason about, a tempo to
 * play at, and per-chord duration and voicing. Everything the advanced editor
 * does is a read or a write against this shape.
 *
 * The beginner (AI) surface still speaks `string[]`; `doc.ts` adapts between
 * the two so both views share one source of truth.
 */

export const DOC_VERSION = 2 as const;

export type Mode =
    | "major"
    | "minor"
    | "dorian"
    | "phrygian"
    | "lydian"
    | "mixolydian"
    | "locrian";

export interface DocKey {
    tonic: string;
    mode: Mode;
}

/**
 * How a chord's notes are spaced once inversion has been applied.
 * - close  — notes stacked as tightly as possible (the default, and what the
 *            beginner view has always played)
 * - drop2  — second voice from the top dropped an octave (open, guitar/piano)
 * - drop3  — third voice from the top dropped an octave (wider still)
 * - shell  — root, 3rd and 7th only; drops the 5th
 * - spread — root left low, everything else lifted an octave
 */
export type VoicingShape = "close" | "drop2" | "drop3" | "shell" | "spread";

export interface ChordSlot {
    id: string;
    /** Canonical symbol from `Chord.get(...).symbol`, e.g. "Fmaj7". */
    symbol: string;
    /** Length in beats. 4 = one bar in 4/4. */
    durationBeats: number;
    /** 0 = root position. Values beyond the chord size wrap. */
    inversion: number;
    voicing: VoicingShape;
    /** Octave of the lowest chord voice. The bass note sits one below. */
    octave: number;
    /**
     * Explicit bass pitch class, which renders the chord as a slash chord.
     * When absent the chord's own bass (or tonic) is used.
     */
    bass?: string;
}

export interface ProgressionDoc {
    version: typeof DOC_VERSION;
    id: string;
    key: DocKey;
    tempo: number;
    /** [beats per bar, beat unit] — e.g. [4, 4]. */
    timeSignature: [number, number];
    slots: ChordSlot[];
    /** The natural-language prompt that produced this, if any. */
    prompt: string;
    /** The AI-assigned style label, if any. */
    style: string;
}

export const DEFAULT_TEMPO = 90;
export const DEFAULT_DURATION_BEATS = 4;
/** Matches the octave the beginner view has always played at. */
export const DEFAULT_OCTAVE = 3;
export const DEFAULT_VOICING: VoicingShape = "close";
export const DEFAULT_TIME_SIGNATURE: [number, number] = [4, 4];
