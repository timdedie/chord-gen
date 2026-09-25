import MidiWriter from "midi-writer-js";
import type { ProgressionDoc } from "./types";

/**
 * MIDI export driven by the document model.
 *
 * Writes each slot's own notes — exactly what playback sounds — at the slot's
 * real duration, and splits the bass (the lowest note) onto its own track so
 * it can be routed separately in a DAW.
 */

/** midi-writer-js uses 128 ticks per quarter note. */
const TICKS_PER_BEAT = 128;

const beatsToTicks = (beats: number) => `T${Math.max(1, Math.round(beats * TICKS_PER_BEAT))}`;

export interface MidiExportOptions {
    /** Write the bass note to a second track. Defaults to true. */
    separateBassTrack?: boolean;
}

/** Returns the MIDI bytes, or null when nothing in the doc is playable. */
export function buildMidi(
    doc: ProgressionDoc,
    { separateBassTrack = true }: MidiExportOptions = {},
): Uint8Array | null {
    const chordTrack = new MidiWriter.Track();
    chordTrack.setTempo(doc.tempo);
    chordTrack.setTimeSignature(doc.timeSignature[0], doc.timeSignature[1], 24, 8);
    chordTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 1 }));

    const bassTrack = new MidiWriter.Track();
    bassTrack.setTempo(doc.tempo);
    bassTrack.setTimeSignature(doc.timeSignature[0], doc.timeSignature[1], 24, 8);
    bassTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 33 }));

    let wroteAnything = false;

    doc.slots.forEach((slot) => {
        const [bass, ...voices] = slot.notes;
        const all = slot.notes;
        const duration = beatsToTicks(slot.durationBeats);

        // Without a separate bass track the bass is folded into the chord.
        const chordNotes = separateBassTrack ? voices : all;

        if (chordNotes.length) {
            chordTrack.addEvent(new MidiWriter.NoteEvent({ pitch: chordNotes, duration }));
            wroteAnything = true;
        } else {
            // Keep the timeline aligned when a slot yields nothing playable.
            chordTrack.addEvent(new MidiWriter.NoteEvent({ pitch: ["C4"], duration, velocity: 0 }));
        }

        if (separateBassTrack) {
            const bassEvent = bass
                ? new MidiWriter.NoteEvent({ pitch: [bass], duration })
                : new MidiWriter.NoteEvent({ pitch: ["C2"], duration, velocity: 0 });
            bassTrack.addEvent(bassEvent);
            if (bass) wroteAnything = true;
        }
    });

    if (!wroteAnything) return null;

    const tracks = separateBassTrack ? [chordTrack, bassTrack] : [chordTrack];
    return new MidiWriter.Writer(tracks).buildFile();
}

const sanitize = (text: string) =>
    text
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^\w-]+/g, "")
        .substring(0, 50) || "progression";

export function midiFilename(doc: ProgressionDoc): string {
    const chords = doc.slots
        .map((slot) => slot.symbol.replace(/\//g, "-").replace(/\s+/g, "_"))
        .join("_");
    const base = sanitize(doc.prompt);
    return chords ? `${base}_${chords}.mid` : `${base}.mid`;
}
