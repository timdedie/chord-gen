import { Chord, Interval, Note } from "tonal";
import {
    DEFAULT_OCTAVE,
    DEFAULT_VOICING,
    type ChordSlot,
    type VoicingShape,
    type ProgressionDoc,
} from "./types";

/**
 * The single voicing engine.
 *
 * Playback and MIDI export used to compute notes independently — playback via
 * a bass-plus-ascending-stack helper and the exporter via raw
 * `Chord.get().notes` at octave 4 — so what you heard was not what you
 * exported. Both now go through this module.
 *
 * There are two paths. `"auto"` (the default) voices a chord *in the context of
 * the one before it*: it thins the chord to the tones worth sounding, then
 * searches the placements of those tones for the one that moves least. The
 * named shapes (`close`, `drop2`, `drop3`, `shell`, `spread`) are the literal,
 * context-free realisations the advanced editor asks for by name, and are left
 * exactly as authored — predictability is the point of that surface.
 *
 * tonal's own `Voicing` module is deliberately not used: its dictionary covers
 * only 16 chord types (sus and extended chords return `undefined`), it drops
 * slash-chord bass notes, and it emits rootless jazz voicings. This engine
 * works for any symbol `Chord.get()` can parse.
 */

export interface VoicedChord {
    /** The bass note, below the chord voices. Null if unparseable. */
    bass: string | null;
    /** The chord voices, ascending. */
    voices: string[];
    /** `bass` followed by `voices` — what you actually play or write. */
    all: string[];
}

const EMPTY: VoicedChord = { bass: null, voices: [], all: [] };

/**
 * Assemble the result, spelling every note with at most one accidental.
 *
 * All the pitch maths above needs tonal's strict spellings, but Cdim7 resolves
 * its seventh to Bbb and the keyboard drops anything that is not `[A-G][#b]?`
 * on the floor — so that voice sounded without ever lighting up a key.
 * `Note.simplify` is pitch-preserving, so this only changes how notes read.
 */
function voiced(bass: string | null, voices: string[]): VoicedChord {
    const spelled = voices.map((n) => Note.simplify(n) || n);
    const low = bass ? Note.simplify(bass) || bass : null;
    return { bass: low, voices: spelled, all: low ? [low, ...spelled] : spelled };
}

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

/* ------------------------------------------------------------------ *
 * Automatic voicing: which tones to sound
 * ------------------------------------------------------------------ */

/** The most voices the automatic path will sound above the bass. */
const MAX_VOICES = 4;

interface Tone {
    note: string;
    num: number;
    quality: string;
}

const isRoot = (t: Tone) => t.num === 1;
const isPerfectFifth = (t: Tone) => t.num === 5 && t.quality === "P";
/** b5 and #5 name the chord as surely as its 3rd does. */
const isAlteredFifth = (t: Tone) => t.num === 5 && t.quality !== "P";
/** The 3rd, or the 2nd/4th standing in for it in a sus chord. */
const isThird = (t: Tone) => t.num === 2 || t.num === 3 || t.num === 4;
const isSeventh = (t: Tone) => t.num === 6 || t.num === 7;

/**
 * Choose which of a chord's tones are actually worth sounding.
 *
 * Sounding all of them is what made extended chords muddy: `Am11` came out as
 * seven notes across three octaves. A player drops tones in a well-known order
 * — the 5th first, because it carries no information, then the root, because
 * the bass is already playing it two octaves down. The 3rd and 7th are the
 * tones that say which chord this is, so they are the last to go.
 */
function selectTones(symbol: string): string[] {
    const { notes, intervals } = Chord.get(symbol);
    if (!notes.length || notes.length !== intervals.length) return notes;

    let kept: Tone[] = notes.map((note, i) => {
        const interval = Interval.get(intervals[i]);
        return { note, num: interval.num ?? 0, quality: interval.q ?? "" };
    });

    const dropFirst = (predicate: (t: Tone) => boolean) => {
        const index = kept.findIndex(predicate);
        if (index >= 0) kept = kept.filter((_, i) => i !== index);
    };

    // An altered 5th (b5, #5, dim, aug) defines the chord and always stays.
    if (kept.length > MAX_VOICES) dropFirst(isPerfectFifth);
    if (kept.length > MAX_VOICES) dropFirst(isRoot);

    // Least characteristic first. An altered 5th is protected alongside the 3rd
    // and 7th until nothing else is left to give: C13b5 has no perfect 5th to
    // shed, and dropping the b5 instead would leave a chord that is not C13b5.
    while (kept.length > MAX_VOICES) {
        const victim =
            kept.find((t) => t.num === 11) ??
            kept.find(isPerfectFifth) ??
            kept.find(isRoot) ??
            kept.find((t) => !isThird(t) && !isSeventh(t) && !isAlteredFifth(t)) ??
            kept.find((t) => !isThird(t) && !isSeventh(t));
        if (!victim) break;
        kept = kept.filter((t) => t !== victim);
    }

    return kept.map((t) => t.note);
}

/* ------------------------------------------------------------------ *
 * Automatic voicing: where to put them
 * ------------------------------------------------------------------ */

/**
 * The register the upper structure lives in, as MIDI numbers. Voicing this
 * high is half the fix on its own: the old engine stacked close-position
 * sevenths from C3, which is exactly the register where they turn boxy.
 */
const FLOOR = 58; // Bb3
const CEILING = 84; // C6
/** Where the top voice — the line the ear actually follows — wants to sit. */
const TOP_TARGET = 72; // C5
const MAX_SPAN = 14;

/**
 * Every placement of these pitch classes that fits the register window.
 *
 * The rotations are taken over *chromatic* order, not tonal's stacked-thirds
 * order. Once the 5th and root are gone a stacked-thirds rotation spans an
 * 11th or more — G13 becomes B-F-A-E, 17 semitones, which fits no window at
 * all — whereas rotating chromatic order generates exactly the compact
 * inversions a hand can reach.
 */
function placements(pcs: string[], maxSpan: number, ceiling: number): string[][] {
    const chromatic = [...pcs].sort((a, b) => (Note.chroma(a) ?? 0) - (Note.chroma(b) ?? 0));
    const out: string[][] = [];

    for (let rotation = 0; rotation < chromatic.length; rotation += 1) {
        const order = [...chromatic.slice(rotation), ...chromatic.slice(0, rotation)];

        for (const startOctave of [3, 4, 5]) {
            const voiced = stackAscending(order, startOctave);
            if (voiced.length !== order.length) continue;

            const low = Note.midi(voiced[0]);
            const high = Note.midi(voiced[voiced.length - 1]);
            if (low === null || high === null) continue;
            if (low < FLOOR || high > ceiling || high - low > maxSpan) continue;

            out.push(voiced);
        }
    }
    return out;
}

/**
 * How bad a placement is, given what was playing before it.
 *
 * The top voice is weighted hardest because it is the line the ear tracks: a
 * progression whose top note lurches around reads as clumsy even when every
 * chord is individually correct. The pull toward `TOP_TARGET` is what stops
 * the whole progression drifting out of register over eight chords.
 */
function placementCost(candidate: string[], previous: number[] | null): number {
    const midi = candidate.map((n) => Note.midi(n) ?? 0);
    const top = midi[midi.length - 1];
    const previousTop = previous?.length ? previous[previous.length - 1] : TOP_TARGET;

    let cost = 2.5 * Math.abs(top - previousTop) + 0.4 * Math.abs(top - TOP_TARGET);

    // Semitones between adjacent voices are not banned — they are the sound of
    // a maj7 or a b9 — but they muddy in proportion to how low they sit, so the
    // bottom pair is charged hardest and a cleaner spelling wins the tie.
    for (let i = 0; i < midi.length - 1; i += 1) {
        if (midi[i + 1] - midi[i] === 1) cost += i === 0 ? 14 : 5;
    }

    // Nearest-note matching, not index matching: chords differ in voice count,
    // and pairing by position invents motion that is not there.
    if (previous?.length) {
        for (const note of midi) {
            cost += Math.min(...previous.map((p) => Math.abs(p - note)));
        }
    }

    return cost;
}

interface AutoVoicing {
    chord: VoicedChord;
    /**
     * What the search actually chose, before the octave doubling is added.
     * The next chord leads from these: the doubled bass is a fixed low note
     * under every chord, so counting it would bias the nearest-note matching
     * toward whatever sits lowest rather than toward real voice motion.
     */
    placement: number[];
}

/** Resolve one chord automatically, given the voicing that preceded it. */
function voiceAuto(slot: ChordSlot, previous: number[] | null): AutoVoicing {
    const chord = Chord.get(slot.symbol);
    if (chord.empty || !chord.notes.length || !chord.tonic) {
        return { chord: EMPTY, placement: [] };
    }

    const pcs = selectTones(slot.symbol);
    if (!pcs.length) return { chord: EMPTY, placement: [] };

    // Widen the window rather than fall silent: a four-note 13th chord with no
    // 5th and no root cannot always be packed inside a compact span.
    let candidates = placements(pcs, MAX_SPAN, CEILING);
    if (!candidates.length) candidates = placements(pcs, 17, CEILING + 4);
    if (!candidates.length) candidates = placements(pcs, 24, 96);
    if (!candidates.length) return { chord: EMPTY, placement: [] };

    let voices = candidates.reduce((best, candidate) =>
        placementCost(candidate, previous) < placementCost(best, previous) ? candidate : best,
    );

    // `octave` shifts the whole voicing rather than pinning the lowest voice:
    // on this path the algorithm owns the register, and the field is left as a
    // transposition so raising it still moves bass and chord together.
    const shift = (slot.octave ?? DEFAULT_OCTAVE) - DEFAULT_OCTAVE;
    if (shift !== 0) {
        const moved = voices.map((n) => Note.transpose(n, Interval.fromSemitones(shift * 12)));
        if (moved.every((n) => Note.midi(n) !== null)) voices = moved;
    }

    const placement = voices.map((n) => Note.midi(n) ?? 0);

    const octave = slot.octave ?? DEFAULT_OCTAVE;
    const bassPc = slot.bass || chord.bass || chord.tonic;
    const bass = `${bassPc}${octave - 1}`;
    if (Note.midi(bass) === null) return { chord: voiced(null, voices), placement };

    // Double the bass an octave up, the way a left hand does.
    //
    // The upper structure lives at C4-C5 and the bass an octave below middle
    // C, which leaves the better part of two octaves empty underneath — and a
    // plain triad is only three notes up there. The progression comes out
    // correct but hollow. This fills the gap without touching the voicing the
    // search chose, and it stays out of the MIDI bass track: an octave belongs
    // under the left hand, not in a bass part.
    const doubled = `${bassPc}${octave}`;
    const lowestVoice = placement.length ? placement[0] : Infinity;
    const withDoubling =
        Note.midi(doubled) !== null && (Note.midi(doubled) as number) < lowestVoice
            ? [doubled, ...voices]
            : voices;

    return { chord: voiced(bass, withDoubling), placement };
}

/* ------------------------------------------------------------------ *
 * Entry points
 * ------------------------------------------------------------------ */

/** Resolve one chord literally, honouring its named shape and inversion. */
function voiceExplicit(slot: ChordSlot, voicing: VoicingShape): VoicedChord {
    const chord = Chord.get(slot.symbol);
    if (chord.empty || !chord.notes.length || !chord.tonic) return EMPTY;

    const octave = slot.octave ?? DEFAULT_OCTAVE;

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
    if (bassMidi === null) return voiced(null, voices);

    // The upper structure can still collide with the bass — Cmaj7/B puts B2
    // a semitone under C3. Lift the whole structure rather than one voice, so
    // the voicing keeps its shape.
    const lowestVoice = Note.midi(voices[0]);
    if (lowestVoice !== null && lowestVoice - bassMidi < smallestSafeInterval(bassMidi)) {
        const lifted = voices.map((note) => Note.transpose(note, "8P"));
        if (lifted.every((note) => Note.midi(note) !== null)) voices = lifted;
    }

    return voiced(bass, voices);
}

/**
 * Resolve a single slot to concrete pitched notes.
 *
 * An `"auto"` slot voiced this way has no previous chord to lean on, so it
 * lands in the middle of the register and nothing more. Prefer `voiceSlots`
 * wherever the whole progression is known — voice leading is the larger half
 * of what makes a progression sound clean, and it needs the context.
 */
export function voiceChord(slot: ChordSlot): VoicedChord {
    const voicing = slot.voicing ?? DEFAULT_VOICING;
    return voicing === "auto" ? voiceAuto(slot, null).chord : voiceExplicit(slot, voicing);
}

/**
 * Resolve a whole progression, each `"auto"` chord voiced against the last.
 *
 * Only the upper structure moves. The bass stays on the root, or on the slash
 * bass when the symbol names one, so smoothing can never quietly rewrite
 * Cmaj7-Am7-Fmaj7-G7 into a C-C-F-F bass line and change the harmony it was
 * asked to smooth. Root motion is the composer's; the voices above it are ours.
 */
export function voiceSlots(slots: ChordSlot[]): VoicedChord[] {
    let previous: number[] | null = null;

    return slots.map((slot) => {
        const voicing = slot.voicing ?? DEFAULT_VOICING;

        if (voicing === "auto") {
            const { chord, placement } = voiceAuto(slot, previous);
            if (placement.length) previous = placement;
            return chord;
        }

        // A named shape is not smoothed, but the chord after it still leads
        // from wherever it actually landed.
        const chord = voiceExplicit(slot, voicing);
        if (chord.voices.length) previous = chord.voices.map((n) => Note.midi(n) ?? 0);
        return chord;
    });
}

export function voiceProgression(doc: ProgressionDoc): VoicedChord[] {
    return voiceSlots(doc.slots);
}

/**
 * The pitch range this engine can produce, for anything that has to display it.
 *
 * The keyboard used to hardcode C3-C5, which was right for the old engine and
 * silently wrong for this one: a quarter of every voicing fell outside it and
 * simply never lit up. The low end is a bass an octave below the chord, and Cb2
 * spells as B1 — so A1 rather than C2. The high end is `CEILING`. Anything
 * reading this should read it rather than restate it; a slot with a raised
 * `octave` can still exceed it, and callers should clamp rather than assume.
 */
export const VOICED_RANGE = { low: "A1", high: "C6" } as const;
