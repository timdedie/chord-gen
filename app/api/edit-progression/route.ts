export const maxDuration = 30;

import { EditProgressionSchema } from '@/lib/schemas';
import { aiRoute, AiRouteError, generateStructured } from '@/lib/ai/gateway';
import { CHORD_GENERATION_SYSTEM_PROMPT } from '@/lib/prompts/system';
import { buildEditProgressionMessage } from '@/lib/prompts/edit-progression';
import { parseVoicedChords } from '@/lib/prompts/format';

interface RequestBody {
    /** The progression being edited, each chord with its notes. */
    chords?: unknown;
    feedback?: string;
    prompt?: string;
}

// Previously the only route with no authentication and no rate limiting, which
// left an unmetered model endpoint open to anyone. `aiRoute` applies both.
export const POST = aiRoute<RequestBody>('edit-progression', async ({ body }) => {
    const { feedback, prompt } = body;
    const chords = parseVoicedChords(body.chords);

    if (!chords.length) {
        throw new AiRouteError('Chords are required to edit a progression.', 400);
    }
    if (!feedback?.trim()) {
        throw new AiRouteError('Feedback is required to edit a progression.', 400);
    }

    return generateStructured({
        task: 'edit-progression',
        userMessage: buildEditProgressionMessage(chords, feedback.trim(), prompt),
        system: CHORD_GENERATION_SYSTEM_PROMPT,
        schema: EditProgressionSchema,
    });
});
