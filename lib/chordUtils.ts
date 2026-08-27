import { createSlot } from "./progression/doc";
import { voiceChord } from "./progression/voicing";

/**
 * Compatibility shim for the beginner view's playback call sites.
 *
 * The voicing logic now lives in `lib/progression/voicing.ts`, shared with MIDI
 * export. Output is unchanged for default slots (close voicing, root position,
 * octave 3 with the bass an octave below). New code should build a `ChordSlot`
 * and call `voiceChord` so per-chord voicing and inversion are honoured.
 */
export function getVoicedChordNotes(chordSymbol: string): string[] {
    return voiceChord(createSlot(chordSymbol)).all;
}
