import { Chord, Interval, Note } from "tonal";
import {
    DEFAULT_OCTAVE,
    DEFAULT_VOICING,
    type ChordSlot,
    type ProgressionDoc,
    type VoicingShape,
} from "./types";

/**
 * The single voicing engine.
 *
 * Playback and MIDI export used to compute notes independently — playback via
 * `getVoicedChordNotes` (bass + ascending stack) and the exporter via raw
 * `Chord.get().notes` at octave 4 — so what you heard was not what you
 * exported. Both now go through `voiceChord`.
 *
 * tonal's own `Voicing` module is deliberately not used: its dictionary covers
 * only 16 chord types (sus and extended chords return `undefined`), it drops
 * slash-chord bass notes, and it emits rootless jazz voicings. This engine
 * works for any symbol `Chord.get()` can parse.
 */

export interface VoicedChord {
    /** The bass note, an octave below the chord voices. Null if unparseable. */
    bass: string | null;
    /** The chord voices, ascending. */
    voices: string[];
    /** `bass` followed by `voices` — what you actually play or write. */
    all: string[];
}

const EMPTY: VoicedChord = { bass: null, voices: [], all: [] };

/** Stack pitch classes upward, each note strictly above the previous. */
function stackAscending(pcs: string[], startOctave: number): string[] {
    const out: string[] = [];
    let prevMidi = -Infinity;
    let octave = startOctave;

    for (const pc of pcs) {
        let name = `${pc}${octave}`;
        let midi = Note.midi(name);
        if (midi === null) continue;

        // Lift into the next octave until this voice clears the one below it.
        while (midi !== null && midi <= prevMidi) {
            octave += 1;
            name = `${pc}${octave}`;
            midi = Note.midi(name);
        }
        if (midi === null) continue;

        out.push(name);
        prevMidi = midi;
    }
    return out;
}

/** Rotate pitch classes so `inversion` determines which note is lowest. */
function applyInversion(pcs: string[], inversion: number): string[] {
    if (pcs.length === 0) return pcs;
    const k = ((inversion % pcs.length) + pcs.length) % pcs.length;
    return [...pcs.slice(k), ...pcs.slice(0, k)];
}

const byPitch = (a: string, b: string) => (Note.midi(a) ?? 0) - (Note.midi(b) ?? 0);

/** Move the nth voice from the top down an octave (drop2 = 2, drop3 = 3). */
function dropVoice(notes: string[], fromTop: number): string[] {
    const index = notes.length - fromTop;
    if (index < 0 || notes.length <= fromTop) return notes;

    const dropped = Note.transpose(notes[index], "-8P");
    if (!Note.midi(dropped)) return notes;

    const rest = notes.filter((_, i) => i !== index);
    return [dropped, ...rest].sort(byPitch);
}

/** Keep root, 3rd and 7th. Falls back to root/3rd/5th when there is no 7th. */
function shellPitchClasses(symbol: string): string[] | null {
    const { notes, intervals } = Chord.get(symbol);
    if (!notes.length || notes.length !== intervals.length) return null;

    const pick = (degrees: number[]) =>
        notes.filter((_, i) => degrees.includes(Interval.get(intervals[i]).num ?? 0));

    const withSeventh = pick([1, 3, 7]);
    if (withSeventh.length >= 3) return withSeventh;

    const triad = pick([1, 3, 5]);
    return triad.length >= 2 ? triad : null;
}

/** Reorder pitch classes to start on the root, undoing tonal's bass-first order. */
function rootOrdered(notes: string[], tonic: string | null): string[] {
    if (!tonic) return notes;
    const index = notes.indexOf(tonic);
    return index <= 0 ? notes : [...notes.slice(index), ...notes.slice(0, index)];
}

/**
 * Low interval limits: the smallest interval that stays clear rather than muddy
 * at a given bass pitch. Standard arranging practice — two notes a tone apart
 * read fine at the top of the staff and turn to mud an octave below middle C.
 */
const LOW_INTERVAL_LIMITS: Array<[maxMidi: number, minSemitones: number]> = [
    [40, 7], // up to E2  — nothing closer than a fifth
    [45, 5], // up to A2  — a fourth
    [47, 4], // up to B2  — a major third
    [52, 3], // up to E3  — a minor third
    [53, 2], // up to F3  — a major second
];

function smallestSafeInterval(midi: number): number {
    for (const [maxMidi, minSemitones] of LOW_INTERVAL_LIMITS) {
        if (midi <= maxMidi) return minSemitones;
    }
    return 1;
}

/**
 * Open out any pair of voices packed too closely for their register, by lifting
 * the upper one an octave. A no-op for chords that were already clear.
 */
function respectLowIntervalLimits(notes: string[]): string[] {
    const result = [...notes];

    for (let i = 0; i < result.length - 1; i += 1) {
        const lower = Note.midi(result[i]);
        const upper = Note.midi(result[i + 1]);
        if (lower === null || upper === null) continue;

        if (upper - lower < smallestSafeInterval(lower)) {
            const lifted = Note.transpose(result[i + 1], "8P");
            if (Note.midi(lifted) !== null) result[i + 1] = lifted;
        }
    }

    return result.sort(byPitch);
}

function shape(notes: string[], voicing: VoicingShape): string[] {
    switch (voicing) {
        case "drop2":
            return dropVoice(notes, 2);
        case "drop3":
            return dropVoice(notes, 3);
        case "spread": {
            if (notes.length < 2) return notes;
            const [low, ...upper] = notes;
            const lifted = upper
                .map((n) => Note.transpose(n, "8P"))
                .filter((n) => Note.midi(n) !== null);
            return lifted.length === upper.length ? [low, ...lifted] : notes;
        }
        case "close":
        case "shell":
        default:
            return notes;
    }
}

/** Resolve a slot to concrete pitched notes. */
export function voiceChord(slot: ChordSlot): VoicedChord {
    const chord = Chord.get(slot.symbol);
    if (chord.empty || !chord.notes.length || !chord.tonic) return EMPTY;

    const octave = slot.octave ?? DEFAULT_OCTAVE;
    const voicing = slot.voicing ?? DEFAULT_VOICING;

    // tonal orders a slash chord's notes bass-first, so stacking them directly
    // would start the upper structure on the bass note — doubling it against
    // the bass an octave below and leaving a semitone or tone cluster in the
    // low register. Pianists voice the upper structure from the root instead.
    const chordTones = rootOrdered(chord.notes, chord.tonic);

    const source =
        voicing === "shell" ? (shellPitchClasses(slot.symbol) ?? chordTones) : chordTones;

    const inverted = applyInversion(source, slot.inversion ?? 0);
    let voices = respectLowIntervalLimits(shape(stackAscending(inverted, octave), voicing));
    if (!voices.length) return EMPTY;

    // An explicit slot bass wins, then the chord's own (slash) bass, then
    // whichever note the inversion put on the bottom — first inversion of C is
    // C/E, so the bass has to follow the inversion rather than stay on the root.
    const bassPc = slot.bass || chord.bass || inverted[0] || chord.tonic;
    const bass = `${bassPc}${octave - 1}`;

    const bassMidi = Note.midi(bass);
    if (bassMidi === null) return { bass: null, voices, all: voices };

    // The upper structure can still collide with the bass — Cmaj7/B puts B2
    // a semitone under C3. Lift the whole structure rather than one voice, so
    // the voicing keeps its shape.
    const lowestVoice = Note.midi(voices[0]);
    if (lowestVoice !== null && lowestVoice - bassMidi < smallestSafeInterval(bassMidi)) {
        const lifted = voices.map((note) => Note.transpose(note, "8P"));
        if (lifted.every((note) => Note.midi(note) !== null)) voices = lifted;
    }

    return { bass, voices, all: [bass, ...voices] };
}

export function voiceProgression(doc: ProgressionDoc): VoicedChord[] {
    return doc.slots.map(voiceChord);
}

/** Total semitone travel between two voicings, matched lowest-to-highest. */
function voiceLeadingCost(from: string[], to: string[]): number {
    const a = from.map((n) => Note.midi(n) ?? 0);
    const b = to.map((n) => Note.midi(n) ?? 0);
    const shared = Math.min(a.length, b.length);

    let cost = 0;
    for (let i = 0; i < shared; i += 1) cost += Math.abs(a[i] - b[i]);
    // Nudge away from voicings that change the number of voices.
    return cost + Math.abs(a.length - b.length) * 6;
}

/**
 * Pick the inversion for each chord that minimises movement from the one
 * before it. Greedy and left-to-right; the first chord is left as authored.
 *
 * The bass is pinned to whatever it was before optimising. Inversion normally
 * moves the bass, which would let this quietly rewrite Cmaj7-Am7-Fmaj7-G7 into
 * a C-C-F-F bass line — turning Am7 into Am7/G7 into G7/F and changing the
 * harmony it was asked to smooth. Root motion is the composer's; only the
 * upper voices are ours to move.
 */
export function optimizeVoiceLeading(slots: ChordSlot[]): ChordSlot[] {
    if (slots.length < 2) return slots;

    const result: ChordSlot[] = [slots[0]];
    let previous = voiceChord(slots[0]).voices;

    for (const slot of slots.slice(1)) {
        const size = Chord.get(slot.symbol).notes.length;
        if (!size || !previous.length) {
            result.push(slot);
            previous = voiceChord(slot).voices;
            continue;
        }

        const pinnedBass = slot.bass ?? voiceChord(slot).bass?.replace(/-?\d+$/, "");

        let best = slot;
        let bestCost = Infinity;
        for (let inversion = 0; inversion < size; inversion += 1) {
            const candidate: ChordSlot = { ...slot, inversion };
            if (pinnedBass) candidate.bass = pinnedBass;

            const { voices } = voiceChord(candidate);
            if (!voices.length) continue;

            const cost = voiceLeadingCost(previous, voices);
            if (cost < bestCost) {
                bestCost = cost;
                best = candidate;
            }
        }

        result.push(best);
        previous = voiceChord(best).voices;
    }

    return result;
}
