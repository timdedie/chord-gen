import { Chord } from "tonal";
import { detectKey } from "./theory";
import { validateVoicing } from "./voicing";
import {
    DEFAULT_DURATION_BEATS,
    DEFAULT_TEMPO,
    DEFAULT_TIME_SIGNATURE,
    DOC_VERSION,
    type ChordSlot,
    type ProgressionDoc,
    type VoicedChord,
} from "./types";

/**
 * Adapters between voiced chord lists and the document model.
 *
 * The beginner view speaks `VoicedChord[]`, and every existing saved row has a
 * `chords` symbol column. Rather than migrate them, `chords` stays as the
 * denormalised view of a doc, so old rows keep working and both surfaces read
 * the same data.
 */

export const newId = () =>
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export function createSlot(chord: VoicedChord, overrides: Partial<ChordSlot> = {}): ChordSlot {
    return {
        id: overrides.id ?? newId(),
        symbol: Chord.get(chord.symbol).symbol || chord.symbol,
        notes: chord.notes,
        durationBeats: overrides.durationBeats ?? DEFAULT_DURATION_BEATS,
    };
}

/**
 * Bare symbols with no notes — for data that predates generated voicings.
 * Nothing invents notes for them, so these chords are silent.
 */
export function unvoiced(symbols: string[]): VoicedChord[] {
    return symbols.map((symbol) => ({ symbol, notes: [] }));
}

interface DocFromChordsOptions {
    id?: string;
    prompt?: string;
    style?: string;
    /** Skips key detection when the key is already known. */
    key?: ProgressionDoc["key"];
    tempo?: number;
}

/** Build a document from a voiced chord list, inferring the key. */
export function docFromChords(
    chords: VoicedChord[],
    options: DocFromChordsOptions = {},
): ProgressionDoc {
    return {
        version: DOC_VERSION,
        id: options.id ?? newId(),
        key: options.key ?? detectKey(chords.map((c) => c.symbol)),
        tempo: options.tempo ?? DEFAULT_TEMPO,
        timeSignature: DEFAULT_TIME_SIGNATURE,
        slots: chords.map((c) => createSlot(c)),
        prompt: options.prompt ?? "",
        style: options.style ?? "",
    };
}

/** The denormalised symbol list the DB column still uses. */
export function chordsFromDoc(doc: ProgressionDoc): string[] {
    return doc.slots.map((slot) => slot.symbol);
}

/** The voiced chord list the beginner surface uses. */
export function voicedChordsFromDoc(doc: ProgressionDoc): VoicedChord[] {
    return doc.slots.map(({ symbol, notes }) => ({ symbol, notes }));
}

/**
 * A stored slot's notes, if they still check out against its symbol. Anything
 * older than version 4 predates generated notes, and anything that fails the
 * check was tampered with. Neither is patched up: the slot comes back with no
 * notes, and the reason is logged.
 */
function storedNotes(slot: Partial<ChordSlot>, symbol: string, current: boolean): string[] {
    if (!current || !Array.isArray(slot.notes)) {
        console.warn(`[doc] ${symbol} has no stored notes (saved before voicings were generated).`);
        return [];
    }
    const checked = validateVoicing(symbol, slot.notes.map(String));
    if (checked.ok) return checked.notes;
    console.warn(`[doc] stored notes rejected — ${checked.error}`);
    return [];
}

/**
 * Coerce anything read from storage into a valid document.
 *
 * Persisted JSON is untrusted: it may be from an older version, hand-edited,
 * or absent entirely. `chords` is the fallback so a row saved before the model
 * existed still opens in the editor.
 */
export function normalizeDoc(raw: unknown, fallbackChords: string[] = []): ProgressionDoc {
    if (!raw || typeof raw !== "object") return docFromChords(unvoiced(fallbackChords));

    const candidate = raw as Partial<ProgressionDoc>;
    if (!Array.isArray(candidate.slots) || candidate.slots.length === 0) {
        return docFromChords(unvoiced(fallbackChords), {
            id: typeof candidate.id === "string" ? candidate.id : undefined,
            prompt: typeof candidate.prompt === "string" ? candidate.prompt : undefined,
            style: typeof candidate.style === "string" ? candidate.style : undefined,
        });
    }

    const current = candidate.version === DOC_VERSION;

    const slots = candidate.slots
        .filter((slot) => slot && typeof slot.symbol === "string" && !Chord.get(slot.symbol).empty)
        .map((slot) =>
            createSlot(
                { symbol: slot.symbol, notes: storedNotes(slot, slot.symbol, current) },
                {
                    id: typeof slot.id === "string" ? slot.id : undefined,
                    durationBeats:
                        typeof slot.durationBeats === "number" && slot.durationBeats > 0
                            ? slot.durationBeats
                            : undefined,
                },
            ),
        );

    if (!slots.length) return docFromChords(unvoiced(fallbackChords));

    const timeSignature =
        Array.isArray(candidate.timeSignature) && candidate.timeSignature.length === 2
            ? (candidate.timeSignature as [number, number])
            : DEFAULT_TIME_SIGNATURE;

    return {
        version: DOC_VERSION,
        id: typeof candidate.id === "string" ? candidate.id : newId(),
        key: candidate.key?.tonic
            ? candidate.key
            : detectKey(slots.map((s) => s.symbol)),
        tempo: typeof candidate.tempo === "number" && candidate.tempo > 0
            ? candidate.tempo
            : DEFAULT_TEMPO,
        timeSignature,
        slots,
        prompt: typeof candidate.prompt === "string" ? candidate.prompt : "",
        style: typeof candidate.style === "string" ? candidate.style : "",
    };
}

/** Total length in beats. */
export function totalBeats(doc: ProgressionDoc): number {
    return doc.slots.reduce((sum, slot) => sum + slot.durationBeats, 0);
}

/** Beat offset of each slot from the start, for timeline layout and playback. */
export function slotOffsets(doc: ProgressionDoc): number[] {
    const offsets: number[] = [];
    let cursor = 0;
    for (const slot of doc.slots) {
        offsets.push(cursor);
        cursor += slot.durationBeats;
    }
    return offsets;
}

/** How long a slot lasts in seconds at the document's tempo. */
export function slotSeconds(doc: ProgressionDoc, slot: ChordSlot): number {
    return (slot.durationBeats * 60) / doc.tempo;
}
