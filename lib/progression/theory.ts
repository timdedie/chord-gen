import { Chord, Interval, Key, Note } from "tonal";
import type { DocKey, Mode, ProgressionDoc } from "./types";

/**
 * Deterministic theory primitives.
 *
 * Everything here is derived from tonal, never from the model. The advanced
 * editor is meant to be predictable — that is what separates it from the
 * natural-language side of the app — so anything that can be computed is.
 */

/**
 * Conventional spelling for each pitch class, by mode. Major keys lean flat
 * (Db, Eb, Ab) and minor keys lean sharp (C#m, F#m, G#m), matching how key
 * signatures are actually written. `spellTonic` overrides these when the
 * progression itself makes the intent clear.
 */
const MAJOR_SPELLING = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const MINOR_SPELLING = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

/**
 * Choose the enharmonic spelling of a tonic.
 *
 * A progression written F#m-D-A-E is in F# minor, not Gb minor — the chords
 * say so. So when a chord root already names this pitch class, that spelling
 * wins; otherwise the progression's overall accidental bias decides, and the
 * conventional spelling is the fallback.
 */
function spellTonic(chroma: number, mode: Mode, symbols: string[]): string {
    const conventional = mode === "minor" ? MINOR_SPELLING[chroma] : MAJOR_SPELLING[chroma];

    let sharps = 0;
    let flats = 0;
    for (const symbol of symbols) {
        const { tonic } = Chord.get(symbol);
        if (!tonic) continue;
        if (Note.chroma(tonic) === chroma) return tonic;
        if (tonic.includes("#")) sharps += 1;
        if (tonic.includes("b")) flats += 1;
    }

    if (sharps > flats) return Note.enharmonic(conventional).includes("#")
        ? Note.enharmonic(conventional)
        : conventional;
    if (flats > sharps) return Note.enharmonic(conventional).includes("b")
        ? Note.enharmonic(conventional)
        : conventional;
    return conventional;
}

/** Diatonic seventh chords of a key, in scale-degree order. */
export function diatonicChords(key: DocKey): string[] {
    if (key.mode === "minor") return Key.minorKey(key.tonic).natural.chords as string[];
    return Key.majorKey(key.tonic).chords as string[];
}

/** Harmonic function of each diatonic degree: T (tonic), SD, or D. */
export function diatonicFunctions(key: DocKey): string[] {
    if (key.mode === "minor") {
        return Key.minorKey(key.tonic).natural.chordsHarmonicFunction as string[];
    }
    return Key.majorKey(key.tonic).chordsHarmonicFunction as string[];
}

interface KeyChords {
    /** Pitch classes of the key's scale. */
    scale: Set<number>;
    /** Chord qualities available on each scale-degree root. */
    byRoot: Map<number, Set<string>>;
    /** Pitch class of the dominant degree. */
    dominant: number | undefined;
}

/**
 * The chords a key makes available.
 *
 * Minor keys union the natural and harmonic forms, because popular music
 * freely mixes them — a progression in A minor uses both Em and E7 as the
 * dominant, and treating either as foreign would misread the key.
 */
function keyChords(key: DocKey): KeyChords {
    const triads =
        key.mode === "minor"
            ? [
                  ...Key.minorKey(key.tonic).natural.triads,
                  ...Key.minorKey(key.tonic).harmonic.triads,
              ]
            : [...Key.majorKey(key.tonic).triads];

    const byRoot = new Map<number, Set<string>>();
    for (const triad of triads) {
        const chord = Chord.get(triad);
        const chroma = chord.tonic ? Note.chroma(chord.tonic) : undefined;
        if (chroma === undefined) continue;
        if (!byRoot.has(chroma)) byRoot.set(chroma, new Set());
        byRoot.get(chroma)!.add(chord.quality);
    }

    const scaleNotes =
        key.mode === "minor"
            ? Key.minorKey(key.tonic).natural.scale
            : Key.majorKey(key.tonic).scale;

    const scale = new Set(
        scaleNotes.map((n) => Note.chroma(n)).filter((c): c is number => c !== undefined),
    );

    const tonicChroma = Note.chroma(key.tonic);
    const dominant = tonicChroma === undefined ? undefined : (tonicChroma + 7) % 12;

    return { scale, byRoot, dominant };
}

/**
 * How well one chord fits a key.
 *
 * Matching a diatonic root *and* quality is the strongest signal. A familiar
 * root carrying an unexpected quality is a borrowed chord or secondary
 * dominant — evidence for the key rather than against it, so it still scores,
 * just lower. Only roots outside the scale count against.
 */
function chordFit(symbol: string, key: KeyChords): number {
    const chord = Chord.get(symbol);
    if (chord.empty || !chord.tonic) return 0;

    const root = Note.chroma(chord.tonic);
    if (root === undefined) return 0;

    const qualities = key.byRoot.get(root);
    let score: number;
    if (qualities?.has(chord.quality)) score = 1;
    else if (qualities) score = 0.4;
    else if (key.scale.has(root)) score = 0.2;
    else score = -0.6;

    // Extensions and alterations that sit outside the scale weigh against it.
    const outside = chord.notes.filter((n) => {
        const chroma = Note.chroma(n);
        return chroma !== undefined && !key.scale.has(chroma);
    }).length;

    return score - outside * 0.25;
}

/**
 * Positional evidence for the tonic.
 *
 * Progressions overwhelmingly open on the tonic and often close on it, and the
 * quality of that chord separates relative keys — the one thing scale content
 * alone cannot do, since C major and A minor share all seven notes.
 */
function tonicEvidence(symbols: string[], key: DocKey): number {
    const tonicChroma = Note.chroma(key.tonic);
    if (tonicChroma === undefined || !symbols.length) return 0;

    const scoreAt = (index: number, weight: number): number => {
        const chord = Chord.get(symbols[index]);
        if (chord.empty || !chord.tonic) return 0;
        if (Note.chroma(chord.tonic) !== tonicChroma) return 0;

        const isMinorish = chord.quality === "Minor" || chord.quality === "Diminished";
        return isMinorish === (key.mode === "minor") ? weight : 0;
    };

    return scoreAt(0, 1.4) + scoreAt(symbols.length - 1, 0.9);
}

/**
 * Infer the most likely key of a progression.
 *
 * Scores every major and minor key on how well its chords account for the
 * progression, weighted by duration, plus positional evidence for the tonic.
 * This is chord-aware rather than a pitch-class histogram (the usual
 * Krumhansl-Schmuckler approach), which matters here because the input is
 * always chord symbols: root and quality carry far more signal than the notes
 * alone, and profile methods are notoriously weak on relative major/minor.
 */
export function detectKey(symbols: string[], durations?: number[]): DocKey {
    const playable = symbols.filter((s) => !Chord.get(s).empty);
    if (!playable.length) return { tonic: "C", mode: "major" };

    let best: DocKey = { tonic: "C", mode: "major" };
    let bestScore = -Infinity;

    for (let chroma = 0; chroma < 12; chroma += 1) {
        for (const mode of ["major", "minor"] as const) {
            const key: DocKey = { tonic: spellTonic(chroma, mode, symbols), mode };
            const chords = keyChords(key);

            let score = 0;
            let sawDominant = false;

            symbols.forEach((symbol, index) => {
                const weight = durations?.[index] ?? 1;
                score += chordFit(symbol, chords) * weight;

                const chord = Chord.get(symbol);
                const root = chord.tonic ? Note.chroma(chord.tonic) : undefined;
                if (root !== undefined && root === chords.dominant && chord.quality === "Major") {
                    sawDominant = true;
                }
            });

            // A major chord on the fifth degree is the clearest cadential marker.
            if (sawDominant) score += 0.5;
            score += tonicEvidence(symbols, key);

            if (score > bestScore) {
                bestScore = score;
                best = key;
            }
        }
    }

    return best;
}

const ACCIDENTAL = (alt: number) => (alt < 0 ? "b".repeat(-alt) : "#".repeat(alt));
const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

/**
 * Render a chord as a Roman numeral relative to a key.
 *
 * tonal's `Progression.toRomanNumerals` returns "VIm7" for A minor in C, which
 * is not how anyone writes it. This follows the convention Hooktheory and most
 * teaching material use: case carries the quality (vi, not VIm) and degrees are
 * spelled against the major scale, so minor keys read bIII / bVI / bVII.
 */
export function toRomanNumeral(symbol: string, key: DocKey): string | null {
    const chord = Chord.get(symbol);
    if (chord.empty || !chord.tonic) return null;

    const interval = Interval.get(Interval.distance(key.tonic, chord.tonic));
    if (interval.empty || interval.num === undefined) return null;

    const degree = ((interval.num - 1) % 7 + 7) % 7;
    const isLower = chord.quality === "Minor" || chord.quality === "Diminished";
    const numeral = isLower ? NUMERALS[degree].toLowerCase() : NUMERALS[degree];

    let suffix = "";
    if (chord.quality === "Diminished") suffix = chord.type.includes("dim7") ? "°7" : "°";
    else if (chord.quality === "Augmented") suffix = "+";
    else if (chord.type.includes("half-diminished")) suffix = "ø7";
    else if (chord.aliases.some((a) => a.includes("maj7"))) suffix = "maj7";
    else if (chord.type.includes("seventh")) suffix = "7";
    else if (chord.type.includes("sixth")) suffix = "6";

    const slash = chord.bass && chord.bass !== chord.tonic ? `/${chord.bass}` : "";
    return `${ACCIDENTAL(interval.alt ?? 0)}${numeral}${suffix}${slash}`;
}

export function romanNumerals(doc: ProgressionDoc): (string | null)[] {
    return doc.slots.map((slot) => toRomanNumeral(slot.symbol, doc.key));
}

export type HarmonicFunction = "T" | "SD" | "D";

/** Harmonic function of a chord in a key, or null when it is not diatonic. */
export function harmonicFunction(symbol: string, key: DocKey): HarmonicFunction | null {
    const chord = Chord.get(symbol);
    if (chord.empty || !chord.tonic) return null;

    const rootChroma = Note.chroma(chord.tonic);
    if (rootChroma === undefined) return null;

    const chords = diatonicChords(key);
    const functions = diatonicFunctions(key);

    for (let i = 0; i < chords.length; i += 1) {
        const diatonic = Chord.get(chords[i]);
        if (!diatonic.tonic || Note.chroma(diatonic.tonic) !== rootChroma) continue;
        const fn = functions[i];
        if (fn === "T" || fn === "SD" || fn === "D") return fn;
    }
    return null;
}

export function transposeDoc(doc: ProgressionDoc, semitones: number): ProgressionDoc {
    const interval = Interval.fromSemitones(semitones);
    const tonic = Note.transpose(doc.key.tonic, interval);

    return {
        ...doc,
        key: { ...doc.key, tonic: Note.simplify(tonic) || doc.key.tonic },
        slots: doc.slots.map((slot) => {
            const transposed = Chord.transpose(slot.symbol, interval);
            const canonical = Chord.get(transposed).symbol;
            return {
                ...slot,
                symbol: canonical || slot.symbol,
                bass: slot.bass ? Note.simplify(Note.transpose(slot.bass, interval)) : undefined,
            };
        }),
    };
}

export const MODES: Mode[] = [
    "major",
    "minor",
    "dorian",
    "phrygian",
    "lydian",
    "mixolydian",
    "locrian",
];
