export interface ProgressionSummary {
    chords: string[];
    style: string;
}

/**
 * One generation round: the progressions that were produced, and the feedback
 * the user gave *before* that round (absent for the initial round and for a
 * plain "generate more" click). Rounds are kept in chronological order so the
 * model can see how the user's taste evolved across the session.
 */
export interface GenerationRound {
    feedback?: string;
    progressions: ProgressionSummary[];
}

export const MAX_FEEDBACK_LENGTH = 300;
/** History is only context — cap it so a long session can't blow up the prompt. */
export const MAX_HISTORY_ROUNDS = 8;
export const MAX_PROGRESSIONS_PER_ROUND = 6;

export function sanitizeFeedback(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().slice(0, MAX_FEEDBACK_LENGTH);
    return trimmed || undefined;
}

/** Normalizes untrusted client history into ordered, capped rounds. */
export function normalizeHistory(rounds: unknown): GenerationRound[] {
    if (!Array.isArray(rounds)) return [];

    return (rounds as GenerationRound[])
        .filter((round) => round && Array.isArray(round.progressions))
        .slice(-MAX_HISTORY_ROUNDS)
        .map((round) => ({
            feedback: sanitizeFeedback(round.feedback),
            progressions: round.progressions
                .filter((p) => p && Array.isArray(p.chords) && p.chords.length > 0)
                .slice(0, MAX_PROGRESSIONS_PER_ROUND)
                .map((p) => ({
                    chords: p.chords.map(String),
                    style: typeof p.style === 'string' ? p.style : '',
                })),
        }))
        .filter((round) => round.progressions.length > 0);
}

/** Every note the user gave across the session, oldest first. */
export function collectFeedback(history: GenerationRound[]): string[] {
    return history
        .map((round) => round.feedback)
        .filter((f): f is string => !!f);
}

function formatProgressions(progressions: ProgressionSummary[]): string {
    return progressions
        .map((p, i) => `  ${i + 1}. ${p.style ? `[${p.style}] ` : ''}${p.chords.join(' → ')}`)
        .join('\n');
}

/** The numbered "here's what you already produced, and why" block. */
export function formatRounds(history: GenerationRound[]): string {
    return history
        .filter((round) => round.progressions.length > 0)
        .map((round, i) => {
            const header = round.feedback
                ? `Round ${i + 1} — after the user said: "${round.feedback}"`
                : i === 0
                    ? `Round ${i + 1} — from the original request:`
                    : `Round ${i + 1} — the user asked for more, no feedback given:`;
            return `${header}\n${formatProgressions(round.progressions)}`;
        })
        .join('\n\n');
}
