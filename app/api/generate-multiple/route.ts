import { createMultipleProgressionsSchema } from '@/lib/schemas';
import { aiRoute, AiRouteError, generateStructured } from '@/lib/ai/gateway';
import { MODEL_ID } from '@/lib/ai/models';
import { CHORD_GENERATION_SYSTEM_PROMPT } from '@/lib/prompts/system';
import { buildMultipleProgressionsMessage } from '@/lib/prompts/generate-multiple';
import { GenerationRound, normalizeHistory, sanitizeFeedback } from '@/lib/prompts/history';
import { clampChordCount, resolveChordCount } from '@/lib/prompts/chordCount';
import { captureServer } from '@/lib/analytics/posthog-server';
import type { VoicedChord } from '@/lib/progression/voicing';
import { cacheKey, readCache, writeCache } from '@/lib/ai/cache';

export const maxDuration = 25;

interface RequestBody {
    prompt: string;
    numChords: number;
    /** Chronological generation history, so the model sees which chords followed which feedback. */
    rounds?: GenerationRound[];
    /** Feedback the user gave on everything generated so far, driving this round. */
    feedback?: string;
}

interface Progression {
    chords: VoicedChord[];
    style: string;
}

/**
 * The length the client is actually looking at: the last round it got back,
 * falling back to the requested count. Feedback like "make it 6 chords" is
 * applied on top of this.
 */
function currentChordCount(history: GenerationRound[], requested: number): number {
    const lastRound = [...history].reverse().find((round) => round.progressions.length > 0);
    const lastLength = lastRound?.progressions[0]?.chords.length;
    return lastLength ? clampChordCount(lastLength) : requested;
}

/** The length the model settled on — the most common across the returned progressions. */
function resultChordCount(progressions: { chords: unknown[] }[], fallback: number): number {
    const tally = new Map<number, number>();
    for (const p of progressions) {
        tally.set(p.chords.length, (tally.get(p.chords.length) ?? 0) + 1);
    }
    let best = fallback;
    let bestCount = 0;
    for (const [length, count] of tally) {
        if (count > bestCount) {
            best = length;
            bestCount = count;
        }
    }
    return best;
}

export const POST = aiRoute<RequestBody>('generate-multiple', async ({ body, userId, role }) => {
    const { prompt, numChords } = body;
    const history = normalizeHistory(body.rounds);
    const feedback = sanitizeFeedback(body.feedback);

    if (!prompt) throw new AiRouteError('Prompt is required.', 400);

    const requestedCount = clampChordCount(numChords ?? 4);
    // Feedback can ask for a different length ("make it 6 chords"). Honour it in
    // the prompt, and let the schema accept any length in range for feedback
    // rounds so a phrasing we didn't parse still generates instead of failing
    // validation on every retry.
    const previousCount = currentChordCount(history, requestedCount);
    const count = feedback ? resolveChordCount(feedback, previousCount) : requestedCount;

    // Only a first round with no feedback is shareable — anything else belongs
    // to one user's session.
    const cacheable = history.length === 0 && !feedback;
    const key = cacheKey(['generate-multiple', 'voiced', prompt, count, MODEL_ID]);

    const result = (cacheable && readCache<{ progressions: Progression[] }>(key)) || await generateStructured({
        task: 'generate-multiple',
        userMessage: buildMultipleProgressionsMessage(
            prompt,
            count,
            history,
            feedback,
            feedback ? previousCount : undefined,
        ),
        system: CHORD_GENERATION_SYSTEM_PROMPT,
        schema: createMultipleProgressionsSchema(count, { allowLengthChange: !!feedback }),
        temperature: 1.2,
    });

    if (cacheable) writeCache(key, result);

    const progressionsWithIds = result.progressions.map((prog: Progression, index: number) => ({
        id: `prog-${Date.now()}-${index}`,
        chords: prog.chords,
        style: prog.style,
    }));

    const finalCount = resultChordCount(progressionsWithIds, count);

    // Server-side truth for the funnel: fires even when client events are
    // blocked by adblock, and carries server-only context (model, role).
    // distinct_id matches the Clerk
    // userId we identify on the client; anonymous users get a stable guest
    // bucket so the event still lands in the funnel.
    await captureServer('generation_succeeded', userId ?? 'anonymous', {
        num_chords: finalCount,
        requested_num_chords: requestedCount,
        chord_count_changed: finalCount !== previousCount,
        model: MODEL_ID,
        role,
        is_generate_more: history.length > 0,
        has_feedback: !!feedback,
        feedback_length: feedback?.length ?? 0,
        feedback_rounds: history.filter((r) => !!r.feedback).length + (feedback ? 1 : 0),
        progression_count: progressionsWithIds.length,
    });

    // `numChords` tells the client which length this round actually landed on,
    // so follow-up rounds and the chord-count selector stay in sync after
    // feedback changed it.
    return {
        progressions: progressionsWithIds,
        numChords: finalCount,
    };
});
