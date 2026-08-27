import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { premiumGenerations } from '@/lib/db/schema';
import { createMultipleProgressionsSchema } from '@/lib/schemas';
import { aiRoute, AiRouteError, generateStructured, tierFor } from '@/lib/ai/gateway';
import {
    FREE_PREMIUM_GENERATIONS_PER_DAY,
    PRO_PREMIUM_GENERATIONS_PER_DAY,
    PREMIUM_MODEL_ID,
    STANDARD_MODEL_ID,
} from '@/lib/ai/models';
import { CHORD_GENERATION_SYSTEM_PROMPT } from '@/lib/prompts/system';
import { buildMultipleProgressionsMessage } from '@/lib/prompts/generate-multiple';
import { GenerationRound, normalizeHistory, sanitizeFeedback } from '@/lib/prompts/history';
import { clampChordCount, resolveChordCount } from '@/lib/prompts/chordCount';
import { captureServer } from '@/lib/analytics/posthog-server';
import { repairProgression } from '@/lib/ai/repair';
import { cacheKey, readCache, writeCache } from '@/lib/ai/cache';

export const runtime = 'edge';
export const maxDuration = 25;

interface RequestBody {
    prompt: string;
    numChords: number;
    /** Chronological generation history, so the model sees which chords followed which feedback. */
    rounds?: GenerationRound[];
    /** Feedback the user gave on everything generated so far, driving this round. */
    feedback?: string;
    /** Legacy flat form of `rounds`, kept so older clients keep working. */
    existingProgressions?: { chords: string[]; style: string }[];
    premium?: boolean;
}

interface Progression {
    chords: string[];
    style: string;
}

/** Normalizes whatever the client sent (new `rounds`, or legacy `existingProgressions`) into ordered rounds. */
function historyFromBody(body: RequestBody): GenerationRound[] {
    if (Array.isArray(body.rounds)) return normalizeHistory(body.rounds);
    if (Array.isArray(body.existingProgressions) && body.existingProgressions.length > 0) {
        return normalizeHistory([{ progressions: body.existingProgressions }]);
    }
    return [];
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
function resultChordCount(progressions: { chords: string[] }[], fallback: number): number {
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

/**
 * Rescue a response that failed validation because one progression was bad.
 *
 * Three good options after three full regenerations is a worse outcome than two
 * good options now, so the malformed ones are dropped and whatever survived is
 * returned. Anything the repair pass could not fix is genuinely unusable.
 */
function salvageProgressions(raw: unknown): { progressions: Progression[] } | null {
    const candidate = raw as { progressions?: unknown };
    if (!Array.isArray(candidate?.progressions)) return null;

    const usable: Progression[] = [];
    for (const entry of candidate.progressions) {
        const item = entry as { chords?: unknown; style?: unknown };
        if (!Array.isArray(item?.chords)) continue;

        const { chords, dropped } = repairProgression(item.chords.map(String));
        if (dropped.length > 0 || chords.length < 2) continue;

        usable.push({ chords, style: typeof item.style === 'string' ? item.style : 'Alternative' });
    }

    return usable.length > 0 ? { progressions: usable } : null;
}

function todayDate(): string {
    return new Date().toISOString().slice(0, 10);
}

/** Atomically claims one of today's premium generation slots for a user. Returns true if claimed. */
async function claimPremiumSlot(userId: string, limit: number): Promise<boolean> {
    const rows = await db
        .insert(premiumGenerations)
        .values({ userId, date: todayDate(), count: 1 })
        .onConflictDoUpdate({
            target: [premiumGenerations.userId, premiumGenerations.date],
            set: { count: sql`${premiumGenerations.count} + 1` },
            where: sql`${premiumGenerations.count} < ${limit}`,
        })
        .returning();

    return rows.length > 0;
}

export const POST = aiRoute<RequestBody>('generate-multiple', async ({ body, userId, role }) => {
    const { prompt, numChords, premium } = body;
    const history = historyFromBody(body);
    const feedback = sanitizeFeedback(body.feedback);

    if (!prompt) throw new AiRouteError('Prompt is required.', 400);

    let premiumGranted = false;
    const unlimitedPremium = role === 'admin';
    if (premium) {
        if (unlimitedPremium) {
            premiumGranted = true;
        } else if (userId) {
            const limit = role === 'pro' ? PRO_PREMIUM_GENERATIONS_PER_DAY : FREE_PREMIUM_GENERATIONS_PER_DAY;
            premiumGranted = await claimPremiumSlot(userId, limit);
        }
    }

    const requestedCount = clampChordCount(numChords ?? 4);
    // Feedback can ask for a different length ("make it 6 chords"). Honour it in
    // the prompt, and let the schema accept any length in range for feedback
    // rounds so a phrasing we didn't parse still generates instead of failing
    // validation on every retry.
    const previousCount = currentChordCount(history, requestedCount);
    const count = feedback ? resolveChordCount(feedback, previousCount) : requestedCount;
    const modelId = premiumGranted ? PREMIUM_MODEL_ID : STANDARD_MODEL_ID;

    // Only a first round with no feedback is shareable — anything else belongs
    // to one user's session. Premium requests are excluded on both counts: the
    // slot is claimed above, so serving a cached result would charge a
    // generation the user never got, and someone spending one expects a fresh
    // answer rather than a neighbour's.
    const cacheable = history.length === 0 && !feedback && !premium;
    const key = cacheKey(['generate-multiple', prompt, count, modelId]);

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
        tier: tierFor(premiumGranted),
        salvage: salvageProgressions,
    });

    if (cacheable) writeCache(key, result);

    const progressionsWithIds = result.progressions.map((prog: Progression, index: number) => ({
        id: `prog-${Date.now()}-${index}`,
        chords: prog.chords,
        style: prog.style,
    }));

    const finalCount = resultChordCount(progressionsWithIds, count);

    // Server-side truth for the funnel: fires even when client events are
    // blocked by adblock, and carries server-only context (model, role, whether
    // a premium slot was actually granted). distinct_id matches the Clerk
    // userId we identify on the client; anonymous users get a stable guest
    // bucket so the event still lands in the funnel.
    await captureServer('generation_succeeded', userId ?? 'anonymous', {
        num_chords: finalCount,
        requested_num_chords: requestedCount,
        chord_count_changed: finalCount !== previousCount,
        model: modelId,
        premium_requested: !!premium,
        premium_granted: premiumGranted,
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
        premiumUsed: premiumGranted,
        unlimitedPremium,
    };
});
