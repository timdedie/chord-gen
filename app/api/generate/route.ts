export const maxDuration = 60;

import {
    createProgressionSchema,
    SingleChordSchema,
} from '@/lib/schemas';
import { auth } from '@clerk/nextjs/server';
import { generateChordObject, createResponse } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rateLimit';
import { getUserRole } from '@/lib/premium';
import { buildProgressionMessage, buildAddChordMessage, SimpleChordObject } from '@/lib/prompts/generate';
import { GenerationRound, normalizeHistory } from '@/lib/prompts/history';

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

interface ApiError extends Error {
    status?: number;
    details?: unknown;
}

export async function POST(request: Request): Promise<Response> {
    try {
        const { userId } = await auth();
        const role = await getUserRole(userId);

        if (role !== 'admin' && !(await checkRateLimit(request))) {
            return createResponse({ error: 'Too many requests. Please try again tomorrow.' }, 429);
        }

        const body = (await request.json()) as RequestBody;
        const { prompt, existingChords = [], addChordPosition, numChords } = body;

        if (typeof addChordPosition === 'number') {
            const history = normalizeHistory(body.rounds);
            const userMessage = buildAddChordMessage(prompt, existingChords, addChordPosition, history);
            const result = await generateChordObject(userMessage, SingleChordSchema);
            return createResponse(result);
        }

        if (!prompt) {
            throw Object.assign(new Error('Prompt is required for progression generation.'), { status: 400 });
        }

        const count = (typeof numChords === 'number' && numChords >= 2 && numChords <= 8) ? numChords : 4;
        const userMessage = buildProgressionMessage(prompt, count);
        const result = await generateChordObject(userMessage, createProgressionSchema(count));
        return createResponse(result);

    } catch (err: unknown) {
        const e = err as ApiError;
        console.error('[API generate] Error:', e.message);

        if (e.details) {
            return createResponse({ error: e.message, details: e.details }, e.status || 500);
        }
        return createResponse({ error: e.message || 'Internal server error' }, e.status || 500);
    }
}
