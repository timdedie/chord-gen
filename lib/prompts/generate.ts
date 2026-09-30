import type { VoicedChord } from '@/lib/progression/voicing';
import { type GenerationRound, collectFeedback, formatRounds } from './history';
import { formatVoicedProgression } from './format';

/**
 * Everything the user has been shown this session, plus the notes they gave
 * along the way. The inserted chord has to live inside that context, so it gets
 * the same history the progression generator sees — framed as direction to
 * honour rather than as a do-not-repeat list.
 */
function buildAddChordHistorySection(history: GenerationRound[]): string {
    const rounds = formatRounds(history);
    if (!rounds) return '';

    const notes = collectFeedback(history);
    const notesLine = notes.length > 0
        ? `The user's notes so far, oldest first: ${notes.map((f) => `"${f}"`).join(', ')}. They are cumulative — honour all of them, and where two conflict the later one wins. The chord you insert has to respect these notes as much as it respects the surrounding harmony.`
        : 'This is the direction the session has taken — the inserted chord should sound like it belongs to it.';

    return `## What the user has seen this session (oldest first)

${rounds}

${notesLine}`;
}

export function buildAddChordMessage(
    prompt: string | undefined,
    existingChords: VoicedChord[],
    addChordPosition: number,
    history: GenerationRound[] = []
): string {
    const hasExisting = existingChords.length > 0;

    const before = hasExisting && addChordPosition > 0
        ? existingChords[addChordPosition - 1].symbol
        : null;
    const after = hasExisting && addChordPosition < existingChords.length
        ? existingChords[addChordPosition].symbol
        : null;

    let context: string;
    if (hasExisting) {
        const progressionStr = formatVoicedProgression(existingChords);
        const position = before && after
            ? `between ${before} and ${after}`
            : before
                ? `after ${before} (at the end)`
                : `before ${after} (at the start)`;
        context = `Progression (each chord's notes in brackets, lowest first): ${progressionStr}\nInsert a new chord ${position}. Voice it so its notes connect smoothly to the voicings on either side — keep common tones and move the other voices by step.`;
    } else {
        context = 'Generate an interesting single starting chord — a strong, clear chord that invites continuation.';
    }

    let requirement: string;
    if (prompt?.trim()) {
        requirement = `Musical direction: "${prompt}". The chord should fulfill this while fitting seamlessly.`;
    } else if (hasExisting) {
        requirement = 'Choose a chord that creates the smoothest, most musical connection. Prioritize voice leading — a slash chord is often the best choice here.';
    } else {
        requirement = 'Make it a solid starting point. A strong triad or basic 7th chord works well.';
    }

    return [context, requirement, buildAddChordHistorySection(history)]
        .filter(Boolean)
        .join('\n\n');
}
