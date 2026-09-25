import { z } from 'zod';
import { MAX_CHORDS, MIN_CHORDS } from './prompts/chordCount';
import { repairChordSymbol } from './ai/repair';
import { MAX_VOICING_NOTES, MIN_VOICING_NOTES, VOICED_RANGE, validateVoicing } from './progression/voicing';

/**
 * Validates a chord symbol, repairing it first.
 *
 * `repairChordSymbol` fixes the near-miss spellings models actually produce —
 * `C△7`, `Am(maj7)`, `B♭maj7`, `Cmaj7add9` — and canonicalises valid ones so
 * the same chord never appears three ways in one progression. This used to be
 * an ad-hoc trim-and-strip inline here, and everything it could not handle cost
 * a full regeneration round trip. Only genuinely unrecognisable symbols now
 * reach the model again.
 */
export const ValidChordStringSchema = z.string()
    .describe("A chord symbol (e.g. F#m7, Cmaj7/E, Bbm)")
    .transform((raw, ctx) => {
        const repaired = repairChordSymbol(raw);
        if (!repaired) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `"${raw}" is not a recognizable chord symbol.`,
            });
            return z.NEVER;
        }
        return repaired;
    });

const voicedChordShape = {
    symbol: ValidChordStringSchema,
    notes: z.array(z.string())
        .describe(`The exact notes to play, lowest first, in scientific pitch notation (C4 = middle C) — e.g. ["D2", "C4", "E4", "F4", "A4"]. The first note is the bass. Colour tones beyond the symbol are welcome. ${MIN_VOICING_NOTES}-${MAX_VOICING_NOTES} notes between ${VOICED_RANGE.low} and ${VOICED_RANGE.high}.`),
};

/**
 * Checks the notes are playable and swaps in their canonical, ascending
 * spelling. They are deliberately not checked against the symbol — colour
 * tones beyond it are the model's to add. Runs after the symbol has parsed, so
 * a bad symbol is reported once rather than again as a voicing problem.
 */
function withValidVoicing<T extends { symbol: string; notes: string[] }>(chord: T, ctx: z.RefinementCtx): T {
    const result = validateVoicing(chord.symbol, chord.notes);
    if (!result.ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error, path: ['notes'] });
        return z.NEVER;
    }
    return { ...chord, notes: result.notes };
}

/** A chord symbol together with the exact notes that voice it. */
export const VoicedChordSchema = z.object(voicedChordShape)
    .transform(withValidVoicing)
    .describe('One chord: its symbol and the exact notes that voice it.');

/**
 * Schema factories — enforce exact chord count at the schema level.
 */
export const createProgressionSchema = (numChords: number) => z.object({
    chords: z.array(VoicedChordSchema)
        .length(numChords)
        .describe(`A ${numChords}-chord progression.`),
});

/**
 * `allowLengthChange` relaxes the exact-count rule to the 2-8 range. Used for
 * feedback rounds: the user may be asking for a different length ("make it 6
 * chords"), and a hard `.length()` would reject the model's correct answer
 * until the request ran out of retries.
 */
export const createMultipleProgressionsSchema = (
    numChords: number,
    { allowLengthChange = false }: { allowLengthChange?: boolean } = {},
) => z.object({
    progressions: z.array(z.object({
        chords: allowLengthChange
            ? z.array(VoicedChordSchema)
                .min(MIN_CHORDS)
                .max(MAX_CHORDS)
                .describe(`A chord progression — ${numChords} chords unless the user's feedback asks for a different length (${MIN_CHORDS}-${MAX_CHORDS}).`)
            : z.array(VoicedChordSchema)
                .length(numChords)
                .describe(`A ${numChords}-chord progression.`),
        style: z.string()
            .describe("A 2-4 word style label (e.g. 'Warm Jazz', 'Dark Cinematic')"),
    }))
        .length(3)
        .describe('3 distinct chord progressions, each with a style label.'),
});

export const EditProgressionSchema = z.object({
    chords: z.array(VoicedChordSchema)
        .min(MIN_CHORDS)
        .max(MAX_CHORDS)
        .describe("The revised chord progression, incorporating the user's requested changes."),
});

/**
 * Alternatives offered when the user asks to replace one chord in a
 * progression. Built per-request so the schema itself can reject a "swap" that
 * just hands back the chord already sitting in that slot.
 */
export const createAlternativeChordsSchema = (originalChord: string) => {
    const normalize = (c: string) => c.trim().toLowerCase();
    const original = normalize(originalChord);

    return z.object({
        alternatives: z.array(z.object({
            ...voicedChordShape,
            label: z.string()
                .describe("A 1-2 word description of the character this swap brings (e.g. 'Brighter', 'Jazzier', 'More tension')"),
        }).transform(withValidVoicing))
            .length(3)
            .describe('3 distinct alternatives for the chord being replaced.')
            .refine(
                (alts) => alts.every((a) => normalize(a.symbol) !== original),
                { message: `Each alternative must differ from the original chord (${originalChord}).` },
            )
            .refine(
                (alts) => new Set(alts.map((a) => normalize(a.symbol))).size === alts.length,
                { message: 'The three alternatives must all be different from each other.' },
            ),
    });
};

/**
 * Type definitions
 */
export type ValidChordString = z.infer<typeof ValidChordStringSchema>;
export type VoicedChordOutput = z.infer<typeof VoicedChordSchema>;
export type AlternativeChord = z.infer<ReturnType<typeof createAlternativeChordsSchema>>['alternatives'][number];
