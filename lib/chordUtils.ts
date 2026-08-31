import { createSlot } from "./progression/doc";
import { voiceSlots } from "./progression/voicing";

/**
 * Compatibility shim for the beginner view's playback call sites.
 *
 * The voicing logic lives in `lib/progression/voicing.ts`, shared with MIDI
 * export. It is progression-level rather than per-chord on purpose: a chord
 * cannot be voiced well without knowing the one before it, since half of what
 * makes a progression sound clean is how little the voices move between
 * chords. Call this once for the whole progression and index the result —
 * voicing chords one at a time throws that context away.
 *
 * New code should build `ChordSlot`s and call `voiceSlots` directly, so
 * per-chord duration, octave and named voicing shapes are honoured.
 */
export function voiceProgressionNotes(chordSymbols: string[]): string[][] {
    return voiceSlots(chordSymbols.map((symbol) => createSlot(symbol))).map((v) => v.all);
}
