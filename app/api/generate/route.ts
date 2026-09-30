export const maxDuration = 30;

import { VoicedChordSchema } from '@/lib/schemas';
import { aiRoute, AiRouteError, generateStructured } from '@/lib/ai/gateway';
import { CHORD_GENERATION_SYSTEM_PROMPT } from '@/lib/prompts/system';
import { buildAddChordMessage } from '@/lib/prompts/generate';
import { parseVoicedChords } from '@/lib/prompts/format';
import { normalizeHistory } from '@/lib/prompts/history';

interface RequestBody {
    prompt?: string;
    /** The progression as it stands, each chord with its notes. */
    existingChords?: unknown;
    /** Where the new chord goes, as an index into `existingChords`. */
    addChordPosition?: number;
    /**
     * Chronological session history — the progressions the user has been shown
     * and the feedback they gave — so the new chord answers the same notes the
     * surrounding progression did.
     */
    rounds?: unknown;
}

/** Generates one chord to insert into an existing progression. */
export const POST = aiRoute<RequestBody>('generate', async ({ body }) => {
    const { prompt, addChordPosition } = body;
    const existingChords = parseVoicedChords(body.existingChords);

    if (
        typeof addChordPosition !== 'number' ||
        !Number.isInteger(addChordPosition) ||
        addChordPosition < 0 ||
        addChordPosition > existingChords.length
    ) {
        throw new AiRouteError('A valid addChordPosition is required.', 400);
    }

    return generateStructured({
        task: 'generate:add-chord',
        userMessage: buildAddChordMessage(prompt, existingChords, addChordPosition, normalizeHistory(body.rounds)),
        system: CHORD_GENERATION_SYSTEM_PROMPT,
        schema: VoicedChordSchema,
    });
});
