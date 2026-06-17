export const maxDuration = 60;

import { EditProgressionSchema } from '@/lib/schemas';
import { generateChordObject, createResponse } from '@/lib/ai';
import { buildEditProgressionMessage } from '@/lib/prompts/edit-progression';

interface RequestBody {
    chords?: string[];
    feedback?: string;
    prompt?: string;
}

interface ApiError extends Error {
    status?: number;
    details?: unknown;
}

export async function POST(request: Request): Promise<Response> {
    try {
        const body = (await request.json()) as RequestBody;
        const { chords = [], feedback, prompt } = body;

        if (!chords.length) {
            throw Object.assign(new Error('Chords are required to edit a progression.'), { status: 400 });
        }
        if (!feedback?.trim()) {
            throw Object.assign(new Error('Feedback is required to edit a progression.'), { status: 400 });
        }

        const userMessage = buildEditProgressionMessage(chords, feedback.trim(), prompt);
        const result = await generateChordObject(userMessage, EditProgressionSchema);
        return createResponse(result);

    } catch (err: unknown) {
        const e = err as ApiError;
        console.error('[API edit-progression] Error:', e.message);

        if (e.details) {
            return createResponse({ error: e.message, details: e.details }, e.status || 500);
        }
        return createResponse({ error: e.message || 'Internal server error' }, e.status || 500);
    }
}
