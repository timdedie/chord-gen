/**
 * The progression document model.
 *
 * A progression used to be a bare `string[]` of chord symbols, which left no
 * room for the things a real editor needs: a key to reason about, a tempo to
 * play at, and per-chord duration and notes. Everything the advanced editor
 * does is a read or a write against this shape.
 *
 * The beginner (AI) surface speaks `VoicedChord[]`; `doc.ts` adapts between
 * the two so both views share one source of truth.
 */

export const DOC_VERSION = 4 as const;

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

/** A chord symbol and the exact notes that realise it. */
export interface VoicedChord {
    symbol: string;
    /**
     * Pitched notes in scientific pitch notation (C4 = middle C), ascending.
     * `notes[0]` is the bass. Chosen by the model alongside the symbol and
     * checked against it by `validateVoicing` — nothing re-voices them.
     */
    notes: string[];
}

export interface ChordSlot extends VoicedChord {
    id: string;
    /** Length in beats. 4 = one bar in 4/4. */
    durationBeats: number;
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
export const DEFAULT_TIME_SIGNATURE: [number, number] = [4, 4];
