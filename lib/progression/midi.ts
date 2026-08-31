import MidiWriter from "midi-writer-js";
import type { ProgressionDoc } from "./types";
import { voiceSlots } from "./voicing";

/**
 * MIDI export driven by the document model.
 *
 * The old exporter wrote every chord as a whole note stacked at octave 4,
 * regardless of what the app had just played. This writes what `voiceSlots`
 * resolves — the same notes as playback, voice leading included — at each
 * slot's real duration, and splits the bass onto its own track so it can be
 * routed separately in a DAW.
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
    const voiced = voiceSlots(doc.slots);

    doc.slots.forEach((slot, index) => {
        const { bass, voices, all } = voiced[index];
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
