export const maxDuration = 30;

import { createAlternativeChordsSchema } from '@/lib/schemas';
import { aiRoute, AiRouteError, generateStructured } from '@/lib/ai/gateway';
import { CHORD_GENERATION_SYSTEM_PROMPT } from '@/lib/prompts/system';
import { buildReplaceChordMessage } from '@/lib/prompts/replace-chord';
import { GenerationRound, normalizeHistory } from '@/lib/prompts/history';

interface RequestBody {
    chords?: string[];
    /** Index of the chord to swap out, within `chords`. */
    index?: number;
    prompt?: string;
    /** Same session history the add-a-chord path uses. */
    rounds?: GenerationRound[];
}

export const POST = aiRoute<RequestBody>('replace-chord', async ({ body }) => {
    const { chords = [], index, prompt } = body;

    if (!chords.length) {
        throw new AiRouteError('Chords are required to replace a chord.', 400);
    }
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= chords.length) {
        throw new AiRouteError('A valid chord index is required.', 400);
    }

    const history = normalizeHistory(body.rounds);

    return generateStructured({
        task: 'replace-chord',
        userMessage: buildReplaceChordMessage(chords.map(String), index, prompt, history),
        system: CHORD_GENERATION_SYSTEM_PROMPT,
        schema: createAlternativeChordsSchema(chords[index]),
    });
});
