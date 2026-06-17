export const maxDuration = 60;

import { auth } from '@clerk/nextjs/server';
import { streamText, ModelMessage } from 'ai';
import { deepseek, STANDARD_MODEL_ID } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rateLimit';
import { getUserRole } from '@/lib/premium';

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

        // SYSTEM MESSAGE: Focus on educational and clear music theory explanations.
        const systemMessage = `You are a knowledgeable and friendly music theory assistant. Your purpose is to help users understand chord progressions by explaining the underlying music theory in a clear, concise, and educational manner. Focus on the most important theoretical aspect or the overall feel of the progression. Keep the explanation very short, ideally 2-3 concise sentences, and start directly with the explanation.`;

        // USER MESSAGE CONTENT: Incorporate the original prompt if available.
        let userMessageContent = `
Please explain the music theory behind the chord progression: **${progressionString}**.
`;

        if (prompt && prompt.trim().length > 0) {
            userMessageContent += `
The user's original request for this progression was: "${prompt}". You can use this context to tailor your explanation if relevant, but prioritize explaining the given chord progression directly.
`;
        }

        userMessageContent += `
Make your explanation educational and relatively easy for a beginner to understand.
Focus on the most important theoretical aspect or the overall feel.

**Keep the explanation very short and to the point, ideally 2-3 concise sentences.**
Start directly with the explanation.

For example, for C - G - Am - F: "This progression in **C Major** uses **G** (dominant) to create tension towards **Am** (relative minor), with **F** (subdominant) often leading back to C. It's a common and effective pop progression."
For Dm7 - G7 - Cmaj7: "A classic **ii-V-I** in C Major. **Dm7** leads to the tension of **G7** (dominant), which strongly resolves to the stable **Cmaj7** (tonic). Fundamental in jazz."
`.trim();

        const messages: ModelMessage[] = [
            { role: 'user', content: userMessageContent }
        ];

        const result = await streamText({
            model: deepseek(STANDARD_MODEL_ID),
            system: systemMessage,
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