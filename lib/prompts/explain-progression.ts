export const EXPLAIN_PROGRESSION_SYSTEM_PROMPT = `You are a knowledgeable and friendly music theory assistant. Your purpose is to help users understand chord progressions by explaining the underlying music theory in a clear, concise, and educational manner. Focus on the most important theoretical aspect or the overall feel of the progression. Keep the explanation very short, ideally 2-3 concise sentences, and start directly with the explanation.`;

export function buildExplainProgressionMessage(progressionString: string, prompt?: string): string {
    let userMessageContent = `
Please explain the music theory behind the chord progression: **${progressionString}**.
`;

    if (prompt && prompt.trim().length > 0) {
        userMessageContent += `
The user's original request for this progression was: "${prompt}". You can use this context to tailor your explanation if relevant, but prioritize explaining the given chord progression directly.
`;
    }

    userMessageContent += `
Make your explanation educational and relatively easy for a beginner to understand.
Focus on the most important theoretical aspect or the overall feel.

**Keep the explanation very short and to the point, ideally 2-3 concise sentences.**
Start directly with the explanation.

For example, for C - G - Am - F: "This progression in **C Major** uses **G** (dominant) to create tension towards **Am** (relative minor), with **F** (subdominant) often leading back to C. It's a common and effective pop progression."
For Dm7 - G7 - Cmaj7: "A classic **ii-V-I** in C Major. **Dm7** leads to the tension of **G7** (dominant), which strongly resolves to the stable **Cmaj7** (tonic). Fundamental in jazz."
`;

    return userMessageContent.trim();
}
