import { z } from 'zod';
import { Chord } from 'tonal';

/**
 * Validates a chord symbol string.
 * Cleans common AI artifacts (quotes, trailing punctuation), then validates with tonal.js.
 */
export const ValidChordStringSchema = z.string()
    .describe("A chord symbol (e.g. F#m7, Cmaj7/E, Bbm)")
    .transform(s => {
        let cleaned = s.trim();
        if ((cleaned.startsWith("'") && cleaned.endsWith("'")) || (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
            cleaned = cleaned.substring(1, cleaned.length - 1).trim();
        }
        return cleaned.replace(/[.,;:!?]$/, "").trim();
    })
    .refine(s => {
        if (!s) return false;
        const chord = Chord.get(s);
        return chord && !chord.empty;
    }, { message: "Invalid or unrecognized chord symbol." });

/**
 * Schema factories — enforce exact chord count at the schema level.
 */
export const createProgressionSchema = (numChords: number) => z.object({
    chords: z.array(ValidChordStringSchema)
        .length(numChords)
        .describe(`A ${numChords}-chord progression.`),
});

export const createMultipleProgressionsSchema = (numChords: number) => z.object({
    progressions: z.array(z.object({
        chords: z.array(ValidChordStringSchema)
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
        .min(2)
        .max(8)
        .describe("The revised chord progression, incorporating the user's requested changes."),
});

export const SingleChordSchema = z.object({
    chord: ValidChordStringSchema.describe("A single chord symbol (e.g. F#m7)"),
});

/**
 * Type definitions
 */
export type ValidChordString = z.infer<typeof ValidChordStringSchema>;
export type SingleChord = z.infer<typeof SingleChordSchema>;
