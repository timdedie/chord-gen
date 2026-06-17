// DeepSeek doesn't support native JSON schema; SDK falls back to system message injection — expected.
(globalThis as Record<string, unknown>).AI_SDK_LOG_WARNINGS = false;

import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateObject, ModelMessage } from 'ai';
import { z } from 'zod';
import { CHORD_FORMATTING_RULES } from './schemas';

const { DEEPSEEK_API_KEY } = process.env;
if (!DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY environment variable is not set.");
}

export const deepseek = createDeepSeek({ apiKey: DEEPSEEK_API_KEY });

export const STANDARD_MODEL_ID = 'deepseek-v4-flash';
export const PREMIUM_MODEL_ID = 'deepseek-v4-pro';
export const FREE_PREMIUM_GENERATIONS_PER_DAY = 30;
export const PRO_PREMIUM_GENERATIONS_PER_DAY = 100;

const MAX_RETRIES = 2;

const SYSTEM_PROMPT = `
You are an expert songwriter and composer. Your goal is to create chord progressions that feel fresh and emotionally compelling — never generic stock patterns.

What makes a great progression:
1. **Harmonic narrative** — the progression tells a story. Build tension, surprise the ear, resolve satisfyingly. Every chord earns its place.
2. **Voice leading** — use slash chords (C/E, Dm/F, G/B) for smooth, stepwise bass motion. This single technique transforms flat progressions into something that breathes.
3. **Borrowed color** — don't shy away from modal interchange (bVII, iv in major), secondary dominants (V/V, V/vi), or chromatic passing chords when they serve the mood.
4. **Restraint** — a well-placed triad is more powerful than a pile of extensions. Add complexity only when it deepens the emotion, not to show off.

Read the user's prompt for intent. If they name a genre, era, or style defined by a canonical progression (blues, doo-wop, classic pop ballad, worship, punk, folk), honor that convention — the familiar pattern *is* the answer. Otherwise, avoid these defaults:
- I–V–vi–IV and its rotations
- i–VI–III–VII and its rotations
- Randomly stacking extensions without harmonic purpose
- Staying purely diatonic when a touch of chromaticism would elevate the progression

The blacklist applies to generic-by-default, not generic-by-request.

${CHORD_FORMATTING_RULES}
`.trim();

export function createResponse(data: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

interface ApiError extends Error {
    status?: number;
    details?: unknown;
}

/**
 * Generates a structured object from the AI model with retry logic.
 * On validation failure, feeds the error back to the model for self-correction.
 */
export async function generateChordObject<T extends z.ZodTypeAny>(
    userMessage: string,
    schema: T,
    temperature: number = 1.0,
    modelId: string = STANDARD_MODEL_ID,
): Promise<z.infer<T>> {
    const modelClient = deepseek(modelId);
    const isPremium = modelId === PREMIUM_MODEL_ID;
    console.log(`[generateChordObject] model=${modelId} isPremium=${isPremium} thinking=off`);
    const messages: ModelMessage[] = [{ role: 'user', content: userMessage }];
    const allErrors: { attempt: number; error: string; response?: unknown }[] = [];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const { object } = await generateObject({
                model: modelClient,
                schema,
                system: SYSTEM_PROMPT,
                messages,
                temperature,
                // Thinking off for both models — DeepSeek has no light reasoning tier
                // (low/medium map to high), so any thinking blows the latency budget.
                providerOptions: {
                    deepseek: {
                        thinking: { type: 'disabled' },
                    },
                },
            });

            const parsed = schema.safeParse(object);
            if (parsed.success) return parsed.data;

            const validationError = parsed.error;
            const errorMessage = `Validation failed: ${JSON.stringify(validationError.format())}`;
            console.error(`[generateChordObject] Attempt ${attempt + 1} failed:`, validationError.format());
            allErrors.push({ attempt: attempt + 1, error: errorMessage, response: object });

            messages.push(
                { role: 'assistant', content: JSON.stringify(object) },
                {
                    role: 'user',
                    content: `Invalid response. Fix these errors:\n${JSON.stringify(validationError.format(), null, 2)}\n\nEvery chord symbol must be musically valid per the formatting rules.`
                }
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[generateChordObject] Attempt ${attempt + 1} threw:`, errorMessage);
            allErrors.push({ attempt: attempt + 1, error: errorMessage });

            if (attempt < MAX_RETRIES) {
                messages.push({
                    role: 'user',
                    content: `Previous attempt failed: "${errorMessage}". Generate a valid response.`
                });
            }
        }
    }

    const finalError = new Error(`AI failed after ${MAX_RETRIES + 1} attempts.`) as ApiError;
    finalError.status = 500;
    finalError.details = { errors: allErrors };
    throw finalError;
}
