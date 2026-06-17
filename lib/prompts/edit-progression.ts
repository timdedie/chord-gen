export function buildEditProgressionMessage(chords: string[], feedback: string, prompt?: string): string {
    const progressionStr = chords.join(' - ');

    let context = `Current progression: ${progressionStr}`;
    if (prompt?.trim()) {
        context += `\nOriginal creative direction: "${prompt}"`;
    }

    return `${context}

Revise this progression based on the following feedback from the user: "${feedback}"

Apply the requested change(s) faithfully while keeping the result musically coherent. Keep the chord count exactly the same as the current progression (${chords.length} chords) unless the user's feedback explicitly asks for a different length (the result must stay between 2 and 8 chords). Return the complete revised progression, not just the changed chords.`.trim();
}
