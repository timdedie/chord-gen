import { Chord } from "tonal";

/**
 * Deterministic repair of chord symbols returned by a model.
 *
 * Models get chord spelling *nearly* right — `C△7`, `Am(maj7)`, `B♭maj7`,
 * `Cmaj7add9` are all unambiguous to a musician and all rejected by tonal.
 * Previously each one cost a full extra generation round trip, which is why the
 * system prompt carried thirty lines of chord-syntax rules. Fixing them here
 * costs microseconds, so the model can be asked for music instead of grammar.
 *
 * Every stage is applied cumulatively and the result tested after each, so the
 * lightest repair that produces a valid chord wins.
 */

/** Quotes, backticks, stray punctuation and whitespace the model wrapped around it. */
function basicClean(input: string): string {
    let s = input.trim().replace(/\s+/g, "");
    while (s.length > 1 && /^["'`]/.test(s) && s.at(-1) === s[0]) {
        s = s.slice(1, -1).trim();
    }
    return s.replace(/[.,;:!?]+$/, "").trim();
}

/** Typographic accidentals and chord glyphs that don't survive a text round trip. */
function unicode(input: string): string {
    return input
        .replace(/[♯＃]/g, "#")
        .replace(/[♭]/g, "b")
        .replace(/[♮]/g, "")
        .replace(/[‐-―−]/g, "-")
        // Order matters: the seventh-bearing glyph is consumed before the bare one,
        // so "C△7" becomes Cmaj7 rather than Cmaj77.
        .replace(/[△Δ∆]7/g, "maj7")
        .replace(/[△Δ∆]/g, "maj7")
        .replace(/[øØ]7/g, "m7b5")
        .replace(/[øØ]/g, "m7b5")
        .replace(/[°]7/g, "dim7")
        .replace(/[°]/g, "dim");
}

/** Spelled-out qualities. */
function words(input: string): string {
    return input
        .replace(/half[\s-]?dim(inished)?7?/gi, "m7b5")
        .replace(/\(?maj(or)?\)?7/gi, "maj7")
        .replace(/min(or)?/gi, "m")
        .replace(/dom(inant)?/gi, "")
        .replace(/augmented/gi, "aug")
        .replace(/diminished/gi, "dim");
}

/**
 * The minor-major seventh, which models write every way except the one tonal
 * accepts. Handled before parentheses are stripped, since `Am(maj7)` would
 * otherwise flatten to the unparseable `Ammaj7`.
 */
function minorMajor(input: string): string {
    return input.replace(/m\(?maj\)?7/gi, "mM7").replace(/m\(?M\)?7/g, "mM7");
}

function parens(input: string): string {
    return input.replace(/[()[\]]/g, "");
}

/** Spellings that are valid music but redundant notation. */
function redundant(input: string): string {
    return input
        .replace(/maj7add(9|11|13)/gi, "maj$1")
        .replace(/7add(9|11|13)/gi, "$1")
        .replace(/^([A-Ga-g][#b]?)maj$/i, "$1")
        .replace(/^([A-Ga-g][#b]?)M$/, "$1");
}

/** A slash with nothing usable after it. */
function slash(input: string): string {
    const trimmed = input.replace(/\/+$/, "");
    const parts = trimmed.split("/");
    if (parts.length < 2) return trimmed;

    const bass = parts[parts.length - 1];
    // Drop a bass note that isn't a note name; the chord itself still stands.
    return /^[A-Ga-g][#b]?$/.test(bass) ? trimmed : parts.slice(0, -1).join("/");
}

const STAGES: Array<(input: string) => string> = [
    basicClean,
    unicode,
    words,
    minorMajor,
    parens,
    redundant,
    slash,
];

/**
 * Preferred spelling per chord type, for display consistency.
 *
 * `Cmaj`, `Fmin` and `C-7` are all valid to tonal, which preserves whatever
 * spelling it was handed — so the same chord can appear three ways in one
 * progression. tonal's own alias order can't be used directly: it would render
 * a minor/major seventh as `Am/ma7`, which reads as a slash chord.
 */
const PREFERRED_SUFFIX: Record<string, string> = {
    major: "",
    minor: "m",
    "major seventh": "maj7",
    "minor seventh": "m7",
    "dominant seventh": "7",
    "half-diminished": "m7b5",
    diminished: "dim",
    "diminished seventh": "dim7",
    augmented: "aug",
    "minor/major seventh": "mM7",
    sixth: "6",
    "minor sixth": "m6",
    "suspended fourth": "sus4",
    "suspended second": "sus2",
    "suspended fourth seventh": "7sus4",
    fifth: "5",
    "major ninth": "maj9",
    "minor ninth": "m9",
    ninth: "9",
    "major thirteenth": "maj13",
    "minor thirteenth": "m13",
    thirteenth: "13",
    eleventh: "11",
    "minor eleventh": "m11",
};

const sameNotes = (a: string[], b: string[]): boolean =>
    a.length === b.length && a.every((note, i) => note === b[i]);

/**
 * Rewrite a valid chord into its preferred spelling.
 *
 * The rewrite is accepted only if it parses back to exactly the same notes and
 * bass, so a wrong table entry can never alter the music — it just leaves the
 * original spelling in place.
 */
function canonicalize(symbol: string): string {
    const chord = Chord.get(symbol);
    if (chord.empty || !chord.tonic) return symbol;

    const suffix = PREFERRED_SUFFIX[chord.type];
    if (suffix === undefined) return symbol;

    const bass = chord.bass ? `/${chord.bass}` : "";
    const candidate = `${chord.tonic}${suffix}${bass}`;
    if (candidate === symbol) return symbol;

    const check = Chord.get(candidate);
    const equivalent =
        !check.empty && sameNotes(check.notes, chord.notes) && check.bass === chord.bass;

    return equivalent ? candidate : symbol;
}

const isValid = (symbol: string): boolean => {
    const chord = Chord.get(symbol);
    return !chord.empty && chord.notes.length > 0;
};

/**
 * Last resort: keep the root and shed suffix characters until what remains
 * parses. `Cmaj9#11b13` degrades to `Cmaj9#11`, then `Cmaj9` — a chord that is
 * still recognisably what was asked for, rather than nothing at all.
 */
function truncateSuffix(symbol: string): string | null {
    const match = symbol.match(/^([A-Ga-g][#b]?)(.*)$/);
    if (!match) return null;

    const [, root, suffix] = match;
    for (let end = suffix.length - 1; end >= 0; end -= 1) {
        const candidate = `${root}${suffix.slice(0, end)}`;
        if (isValid(candidate)) return canonicalize(Chord.get(candidate).symbol);
    }
    return null;
}

/**
 * Repair one chord symbol, returning the canonical form or null if it is not a
 * chord at all (`N.C.`, prose, an empty string).
 */
export function repairChordSymbol(raw: string): string | null {
    if (typeof raw !== "string" || !raw.trim()) return null;

    if (isValid(raw.trim())) return canonicalize(Chord.get(raw.trim()).symbol);

    let current = raw;
    for (const stage of STAGES) {
        current = stage(current);
        if (isValid(current)) return canonicalize(Chord.get(current).symbol);
    }

    return truncateSuffix(current);
}

export interface RepairReport {
    /** The chords that survived, canonicalised. */
    chords: string[];
    /** Symbols that needed repair, as `[before, after]`. */
    repaired: Array<[string, string]>;
    /** Symbols that could not be salvaged and were dropped. */
    dropped: string[];
}

/** Repair a whole progression, reporting what changed. */
export function repairProgression(symbols: string[]): RepairReport {
    const report: RepairReport = { chords: [], repaired: [], dropped: [] };

    for (const symbol of symbols) {
        const fixed = repairChordSymbol(symbol);
        if (!fixed) {
            report.dropped.push(symbol);
            continue;
        }
        if (fixed !== symbol.trim()) report.repaired.push([symbol, fixed]);
        report.chords.push(fixed);
    }

    return report;
}
