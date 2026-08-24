import { type GenerationRound, collectFeedback, formatRounds } from './history';

/**
 * The session so far, framed as direction the substitutions have to respect —
 * a replacement that ignores the user's notes is no more useful than the chord
 * they're trying to get rid of.
 */
function buildHistorySection(history: GenerationRound[]): string {
    const rounds = formatRounds(history);
    if (!rounds) return '';

    const notes = collectFeedback(history);
    const notesLine = notes.length > 0
        ? `The user's notes so far, oldest first: ${notes.map((f) => `"${f}"`).join(', ')}. They are cumulative — honour all of them, and where two conflict the later one wins.`
        : 'This is the direction the session has taken — every alternative should still sound like it belongs to it.';

    return `## What the user has seen this session (oldest first)

${rounds}

${notesLine}`;
}

/**
 * Asks for three swaps for one slot in an existing progression. The chords
 * around the slot are fixed, so the alternatives are judged on how they connect
 * to their neighbours rather than in isolation.
 */
export function buildReplaceChordMessage(
    chords: string[],
    index: number,
    prompt: string | undefined,
    history: GenerationRound[] = [],
): string {
    const original = chords[index];
    const before = index > 0 ? chords[index - 1] : null;
    const after = index < chords.length - 1 ? chords[index + 1] : null;

    const progressionStr = chords
        .map((c, i) => (i === index ? `[${c}]` : c))
        .join(' - ');

    const neighbours = before && after
        ? `It sits between ${before} and ${after}, so each alternative has to lead out of ${before} and into ${after}.`
        : before
            ? `It is the last chord, following ${before} — each alternative has to resolve the progression convincingly.`
            : after
                ? `It is the opening chord, leading into ${after} — each alternative has to set up the progression convincingly.`
                : 'It is the only chord in the progression.';

    const direction = prompt?.trim()
        ? `Musical direction for the progression: "${prompt}". Every alternative must still serve it.`
        : 'Stay true to the character the progression already has.';

    const context = `Progression: ${progressionStr}

Replace the bracketed chord, ${original}. ${neighbours}

${direction}`;

    const requirement = `Give exactly 3 alternatives to ${original}, and make them genuinely different from one another — not three voicings of the same idea. Aim for a spread such as:
- A close substitution that keeps the same function but changes the colour (relative minor/major, added extension, inversion or slash chord for smoother bass)
- A borrowed or chromatic option (modal interchange, secondary dominant, diminished passing chord)
- A more adventurous re-harmonisation that still resolves into the next chord

None of them may be ${original} itself, and none may duplicate another chord already in the progression unless that repetition is genuinely the strongest option. Label each with 1-2 words describing what it does to the feel (e.g. "Brighter", "More tension", "Jazzier").`;

    return [context, requirement, buildHistorySection(history)]
        .filter(Boolean)
        .join('\n\n');
}
