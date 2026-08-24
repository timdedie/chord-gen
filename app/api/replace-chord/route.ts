export const maxDuration = 60;

import { createAlternativeChordsSchema } from '@/lib/schemas';
import { auth } from '@clerk/nextjs/server';
import { generateChordObject, createResponse } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rateLimit';
import { getUserRole } from '@/lib/premium';
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
        const { chords = [], index, prompt } = body;

        if (!chords.length) {
            throw Object.assign(new Error('Chords are required to replace a chord.'), { status: 400 });
        }
        if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= chords.length) {
            throw Object.assign(new Error('A valid chord index is required.'), { status: 400 });
        }

        const history = normalizeHistory(body.rounds);
        const userMessage = buildReplaceChordMessage(chords.map(String), index, prompt, history);
        const result = await generateChordObject(userMessage, createAlternativeChordsSchema(chords[index]));
        return createResponse(result);

    } catch (err: unknown) {
        const e = err as ApiError;
        console.error('[API replace-chord] Error:', e.message);

        if (e.details) {
            return createResponse({ error: e.message, details: e.details }, e.status || 500);
        }
        return createResponse({ error: e.message || 'Internal server error' }, e.status || 500);
    }
}
