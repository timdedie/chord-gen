export const maxDuration = 30;

import { createProgressionSchema, SingleChordSchema } from '@/lib/schemas';
import { aiRoute, AiRouteError, generateStructured } from '@/lib/ai/gateway';
import { CHORD_GENERATION_SYSTEM_PROMPT } from '@/lib/prompts/system';
import { buildProgressionMessage, buildAddChordMessage, SimpleChordObject } from '@/lib/prompts/generate';
import { GenerationRound, normalizeHistory } from '@/lib/prompts/history';
import { cacheKey, readCache, writeCache } from '@/lib/ai/cache';
import { clampChordCount } from '@/lib/prompts/chordCount';

interface RequestBody {
    prompt?: string;
    existingChords?: SimpleChordObject[];
    addChordPosition?: number;
    numChords?: number;
    /**
     * Chronological session history — the progressions the user has been shown
     * and the feedback they gave. Only used when inserting a chord, so the new
     * chord answers the same notes the surrounding progression did.
     */
    rounds?: GenerationRound[];
}

export const POST = aiRoute<RequestBody>('generate', async ({ body }) => {
    const { prompt, existingChords = [], addChordPosition, numChords } = body;

    if (typeof addChordPosition === 'number') {
        const history = normalizeHistory(body.rounds);
        return generateStructured({
            task: 'generate:add-chord',
            userMessage: buildAddChordMessage(prompt, existingChords, addChordPosition, history),
            system: CHORD_GENERATION_SYSTEM_PROMPT,
            schema: SingleChordSchema,
        });
    }

    if (!prompt) {
        throw new AiRouteError('Prompt is required for progression generation.', 400);
    }

    const count = clampChordCount(numChords ?? 4);

    // A bare prompt with no session context always asks the same question, so
    // repeat requests for a popular prompt can share an answer.
    const key = cacheKey(['generate', prompt, count]);
    const cached = readCache<{ chords: string[] }>(key);
    if (cached) return cached;

    const result = await generateStructured({
        task: 'generate',
        userMessage: buildProgressionMessage(prompt, count),
        system: CHORD_GENERATION_SYSTEM_PROMPT,
        schema: createProgressionSchema(count),
    });

    writeCache(key, result);
    return result;
});
