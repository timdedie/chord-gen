import { z } from 'zod';
import { MAX_CHORDS, MIN_CHORDS } from './prompts/chordCount';
import { repairChordSymbol } from './ai/repair';

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

/**
 * Schema factories — enforce exact chord count at the schema level.
 */
export const createProgressionSchema = (numChords: number) => z.object({
    chords: z.array(ValidChordStringSchema)
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
            ? z.array(ValidChordStringSchema)
                .min(MIN_CHORDS)
                .max(MAX_CHORDS)
                .describe(`A chord progression — ${numChords} chords unless the user's feedback asks for a different length (${MIN_CHORDS}-${MAX_CHORDS}).`)
            : z.array(ValidChordStringSchema)
                .length(numChords)
                .describe(`A ${numChords}-chord progression.`),
        style: z.string()
            .describe("A 2-4 word style label (e.g. 'Warm Jazz', 'Dark Cinematic')"),
    }))
        .length(3)
        .describe('3 distinct chord progressions, each with a style label.'),
});

export const EditProgressionSchema = z.object({
    chords: z.array(ValidChordStringSchema)
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
            chord: ValidChordStringSchema.describe("A substitute chord symbol (e.g. Am7, F/A)"),
            label: z.string()
                .describe("A 1-2 word description of the character this swap brings (e.g. 'Brighter', 'Jazzier', 'More tension')"),
        }))
            .length(3)
            .describe('3 distinct alternatives for the chord being replaced.')
            .refine(
                (alts) => alts.every((a) => normalize(a.chord) !== original),
                { message: `Each alternative must differ from the original chord (${originalChord}).` },
            )
            .refine(
                (alts) => new Set(alts.map((a) => normalize(a.chord))).size === alts.length,
                { message: 'The three alternatives must all be different from each other.' },
            ),
    });
};

export const SingleChordSchema = z.object({
    chord: ValidChordStringSchema.describe("A single chord symbol (e.g. F#m7)"),
});

/**
 * Type definitions
 */
export type ValidChordString = z.infer<typeof ValidChordStringSchema>;
export type SingleChord = z.infer<typeof SingleChordSchema>;
export type AlternativeChord = z.infer<ReturnType<typeof createAlternativeChordsSchema>>['alternatives'][number];
