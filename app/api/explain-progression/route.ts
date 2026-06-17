export const maxDuration = 60;

import { auth } from '@clerk/nextjs/server';
import { streamText, ModelMessage } from 'ai';
import { deepseek, STANDARD_MODEL_ID } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rateLimit';
import { getUserRole } from '@/lib/premium';
import { EXPLAIN_PROGRESSION_SYSTEM_PROMPT, buildExplainProgressionMessage } from '@/lib/prompts/explain-progression';

export async function POST(request: Request) {
    try {
        const { userId } = await auth();
        const role = await getUserRole(userId);

        if (role !== 'admin' && !(await checkRateLimit(request))) {
            return new Response(
                JSON.stringify({ error: 'Too many requests. Please try again tomorrow.' }),
                { status: 429, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { chords, prompt } = await request.json() as { chords: string[], prompt?: string };

        if (!chords || chords.length === 0) {
            return new Response(JSON.stringify({ error: "No chords provided for explanation." }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const progressionString = chords.join(' - ');

        const userMessageContent = buildExplainProgressionMessage(progressionString, prompt);

        const messages: ModelMessage[] = [
            { role: 'user', content: userMessageContent }
        ];

        const result = await streamText({
            model: deepseek(STANDARD_MODEL_ID),
            system: EXPLAIN_PROGRESSION_SYSTEM_PROMPT,
            messages: messages,
            temperature: 0.6,
            maxOutputTokens: 300,
        });

        return result.toTextStreamResponse();

    } catch (error: unknown) {
        console.error('API Error in /api/explain-progression:', error);
        const err = error as Error & { status?: number };
        return new Response(
            JSON.stringify({ error: err.message || 'Internal server error' }),
            { status: err.status || 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}