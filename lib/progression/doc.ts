import { Chord } from "tonal";
import { detectKey } from "./theory";
import {
    DEFAULT_DURATION_BEATS,
    DEFAULT_OCTAVE,
    DEFAULT_TEMPO,
    DEFAULT_TIME_SIGNATURE,
    DEFAULT_VOICING,
    DOC_VERSION,
    type ChordSlot,
    type ProgressionDoc,
} from "./types";

/**
 * Adapters between the legacy `string[]` progression and the document model.
 *
 * The beginner view and every existing saved row speak `string[]`. Rather than
 * migrate them, `chords` stays as the denormalised view of a doc, so old rows
 * keep working and both surfaces read the same data.
 */

export const newId = () =>
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export function createSlot(symbol: string, overrides: Partial<ChordSlot> = {}): ChordSlot {
    const canonical = Chord.get(symbol).symbol || symbol;
    return {
        id: overrides.id ?? newId(),
        symbol: canonical,
        durationBeats: overrides.durationBeats ?? DEFAULT_DURATION_BEATS,
        inversion: overrides.inversion ?? 0,
        voicing: overrides.voicing ?? DEFAULT_VOICING,
        octave: overrides.octave ?? DEFAULT_OCTAVE,
        ...(overrides.bass ? { bass: overrides.bass } : {}),
    };
}

interface DocFromChordsOptions {
    id?: string;
    prompt?: string;
    style?: string;
    /** Skips key detection when the key is already known. */
    key?: ProgressionDoc["key"];
    tempo?: number;
}

/** Build a document from a bare chord list, inferring the key. */
export function docFromChords(
    chords: string[],
    options: DocFromChordsOptions = {},
): ProgressionDoc {
    return {
        version: DOC_VERSION,
        id: options.id ?? newId(),
        key: options.key ?? detectKey(chords),
        tempo: options.tempo ?? DEFAULT_TEMPO,
        timeSignature: DEFAULT_TIME_SIGNATURE,
        slots: chords.map((c) => createSlot(c)),
        prompt: options.prompt ?? "",
        style: options.style ?? "",
    };
}

/** The denormalised view the beginner surface and the DB column still use. */
export function chordsFromDoc(doc: ProgressionDoc): string[] {
    return doc.slots.map((slot) => slot.symbol);
}

/**
 * Coerce anything read from storage into a valid document.
 *
 * Persisted JSON is untrusted: it may be from an older version, hand-edited,
 * or absent entirely. `chords` is the fallback so a row saved before the model
 * existed still opens in the editor.
 */
export function normalizeDoc(raw: unknown, fallbackChords: string[] = []): ProgressionDoc {
    if (!raw || typeof raw !== "object") return docFromChords(fallbackChords);

    const candidate = raw as Partial<ProgressionDoc>;
    if (!Array.isArray(candidate.slots) || candidate.slots.length === 0) {
        return docFromChords(fallbackChords, {
            id: typeof candidate.id === "string" ? candidate.id : undefined,
            prompt: typeof candidate.prompt === "string" ? candidate.prompt : undefined,
            style: typeof candidate.style === "string" ? candidate.style : undefined,
        });
    }

    // Nothing before version 3 could choose a voicing — no surface exposed the
    // field — so a stored shape there is the old default rather than a
    // decision, and is dropped so those progressions get the current engine.
    const storedVoicings = candidate.version === DOC_VERSION;

    const slots = candidate.slots
        .filter((slot) => slot && typeof slot.symbol === "string")
        .map((slot) =>
            createSlot(slot.symbol, storedVoicings ? slot : { ...slot, voicing: undefined }),
        )
        .filter((slot) => !Chord.get(slot.symbol).empty);

    if (!slots.length) return docFromChords(fallbackChords);

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
