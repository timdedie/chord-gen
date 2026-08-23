import {
    type GenerationRound,
    type ProgressionSummary,
    collectFeedback,
    formatRounds,
} from './history';

export type { GenerationRound, ProgressionSummary };

function buildHistorySection(history: GenerationRound[]): string {
    const rounds = formatRounds(history);
    if (!rounds) return '';

    return `

## What you already gave the user (oldest first)

${rounds}

Never repeat or closely resemble any progression above — the user has already seen them.`;
}

export function buildMultipleProgressionsMessage(
    prompt: string,
    numChords: number,
    history?: GenerationRound[],
    feedback?: string
): string {
    const historySection = history && history.length > 0 ? buildHistorySection(history) : '';

    const priorFeedback = collectFeedback(history ?? []);

    let directionSection: string;

    if (feedback) {
        const standing = priorFeedback.length > 0
            ? `\n\nEarlier feedback in this session, oldest first: ${priorFeedback.map((f) => `"${f}"`).join(', ')}. Feedback is cumulative — keep honouring the earlier notes unless the newest one contradicts them, in which case the newest wins.`
            : '';

        directionSection = `
## The user's feedback on what you gave them

"${feedback}"

This is a correction, not a new prompt. Keep serving the original request — "${prompt}" — but bend the harmony to satisfy this note. Every one of the 3 new progressions must clearly answer the feedback; vary *how* they answer it rather than whether they do.${standing}

Treat the feedback as being about the music. If it names something you cannot express harmonically, express the closest harmonic equivalent.`.trim();
    } else {
        const standing = priorFeedback.length > 0
            ? `\n\nThe user's standing feedback from this session, oldest first: ${priorFeedback.map((f) => `"${f}"`).join(', ')}. Keep honouring it — most recent note wins where they conflict.`
            : '';

        directionSection = `
Give the user three genuinely different angles on the prompt:
- **Progression 1 — Faithful:** The most direct, satisfying read. The version that "just works."
- **Progression 2 — Elevated:** A richer take — smarter voice leading, a borrowed chord, a secondary dominant, an unexpected resolution.
- **Progression 3 — Reimagined:** A different angle entirely — different key, mode, or harmonic language. Should still serve the prompt's emotional intent.${standing}`.trim();
    }

    return `
Create 3 distinct ${numChords}-chord progressions for: "${prompt}"${historySection}

These are *alternatives* the user picks between — they don't need to relate to each other. Each one stands on its own. The hard requirement: the chords *within* a single progression must flow coherently and sound intentional together.

${directionSection}

Choose whatever key best serves each progression — only lock to a specific key if the user named one in their prompt or feedback.

Label each with a 2-4 word descriptor of its character (e.g. "Open and Direct", "Warm Jazz Lift", "Dorian Reframing").
  `.trim();
}
