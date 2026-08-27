export const maxDuration = 30;

import { streamText, type ModelMessage } from 'ai';
import { aiRoute, AiRouteError } from '@/lib/ai/gateway';
import { modelChain, providerOptions, resolveModel } from '@/lib/ai/models';
import {
    EXPLAIN_PROGRESSION_SYSTEM_PROMPT,
    buildExplainProgressionMessage,
} from '@/lib/prompts/explain-progression';

interface RequestBody {
    chords?: string[];
    prompt?: string;
}

export const POST = aiRoute<RequestBody>('explain-progression', async ({ body }) => {
    const { chords = [], prompt } = body;

    if (!chords.length) {
        throw new AiRouteError('No chords provided for explanation.', 400);
    }

    const messages: ModelMessage[] = [
        { role: 'user', content: buildExplainProgressionMessage(chords.join(' - '), prompt) },
    ];

    // Streaming can't fall back mid-response, so this takes the head of the
    // chain and streams it. A provider outage surfaces as a failed stream.
    const [spec] = modelChain('standard');

    const result = await streamText({
        model: resolveModel(spec),
        system: EXPLAIN_PROGRESSION_SYSTEM_PROMPT,
        messages,
        temperature: 0.6,
        maxOutputTokens: 300,
        providerOptions: providerOptions(spec),
    });

    return result.toTextStreamResponse();
});
