// DeepSeek doesn't support native JSON schema; SDK falls back to system message injection — expected.
(globalThis as Record<string, unknown>).AI_SDK_LOG_WARNINGS = false;

import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateObject, ModelMessage } from 'ai';
import { z } from 'zod';
import { CHORD_GENERATION_SYSTEM_PROMPT } from './prompts/system';
import { buildValidationErrorMessage } from './prompts/retry';

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
                system: CHORD_GENERATION_SYSTEM_PROMPT,
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
                    content: buildValidationErrorMessage(validationError.format())
                }
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[generateChordObject] Attempt ${attempt + 1} threw:`, errorMessage);
            allErrors.push({ attempt: attempt + 1, error: errorMessage });
        }
    }

    const finalError = new Error(`AI failed after ${MAX_RETRIES + 1} attempts.`) as ApiError;
    finalError.status = 500;
    finalError.details = { errors: allErrors };
    throw finalError;
}
