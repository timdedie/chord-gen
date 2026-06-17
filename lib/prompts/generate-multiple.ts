export function buildMultipleProgressionsMessage(
    prompt: string,
    numChords: number,
    existingProgressions?: { chords: string[]; style: string }[]
): string {
    let existingSection = '';
    if (existingProgressions && existingProgressions.length > 0) {
        const listing = existingProgressions
            .map((p, i) => `  ${i + 1}. [${p.style}] ${p.chords.join(' → ')}`)
            .join('\n');
        existingSection = `\n\nThe user already has these progressions. Generate completely DIFFERENT ones — different keys, modes, and harmonic approaches. Do NOT repeat or closely resemble any of these:\n${listing}`;
    }

    return `
Create 3 distinct ${numChords}-chord progressions for: "${prompt}"${existingSection}

These are *alternatives* the user picks between — they don't need to relate to each other. Each one stands on its own. The hard requirement: the chords *within* a single progression must flow coherently and sound intentional together.

Give the user three genuinely different angles on the prompt:
- **Progression 1 — Faithful:** The most direct, satisfying read. The version that "just works."
- **Progression 2 — Elevated:** A richer take — smarter voice leading, a borrowed chord, a secondary dominant, an unexpected resolution.
- **Progression 3 — Reimagined:** A different angle entirely — different key, mode, or harmonic language. Should still serve the prompt's emotional intent.

Choose whatever key best serves each progression — only lock to a specific key if the user named one.

Label each with a 2-4 word descriptor of its character (e.g. "Open and Direct", "Warm Jazz Lift", "Dorian Reframing").
  `.trim();
}
