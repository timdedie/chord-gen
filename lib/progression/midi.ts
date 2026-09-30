import MidiWriter from "midi-writer-js";
import type { VoicedChord } from "./voicing";

/**
 * MIDI export: each chord's own notes — exactly what playback sounds — one bar
 * each, with the bass (the lowest note) on its own track so it can be routed
 * separately in a DAW.
 */

const TEMPO = 90;
/** One bar of 4/4 per chord. midi-writer-js uses 128 ticks per quarter note. */
const CHORD_DURATION = `T${4 * 128}`;

/** Returns the MIDI bytes, or null when no chord has notes. */
export function buildMidi(chords: VoicedChord[]): Uint8Array | null {
    const chordTrack = new MidiWriter.Track();
    chordTrack.setTempo(TEMPO);
    chordTrack.setTimeSignature(4, 4, 24, 8);
    chordTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 1 }));

    const bassTrack = new MidiWriter.Track();
    bassTrack.setTempo(TEMPO);
    bassTrack.setTimeSignature(4, 4, 24, 8);
    bassTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 33 }));

    let wroteAnything = false;

    for (const { notes } of chords) {
        const [bass, ...voices] = notes;

        // A silent event keeps the timeline aligned when a chord has no notes.
        chordTrack.addEvent(
            voices.length
                ? new MidiWriter.NoteEvent({ pitch: voices, duration: CHORD_DURATION })
                : new MidiWriter.NoteEvent({ pitch: ["C4"], duration: CHORD_DURATION, velocity: 0 }),
        );
        bassTrack.addEvent(
            bass
                ? new MidiWriter.NoteEvent({ pitch: [bass], duration: CHORD_DURATION })
                : new MidiWriter.NoteEvent({ pitch: ["C2"], duration: CHORD_DURATION, velocity: 0 }),
        );
        if (bass) wroteAnything = true;
    }

    return wroteAnything ? new MidiWriter.Writer([chordTrack, bassTrack]).buildFile() : null;
}

const sanitize = (text: string) =>
    text
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^\w-]+/g, "")
        .substring(0, 50) || "progression";

export function midiFilename(prompt: string, chords: VoicedChord[]): string {
    const symbols = chords
        .map((c) => c.symbol.replace(/\//g, "-").replace(/\s+/g, "_"))
        .join("_");
    const base = sanitize(prompt);
    return symbols ? `${base}_${symbols}.mid` : `${base}.mid`;
}
