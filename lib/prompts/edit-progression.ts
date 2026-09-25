import type { VoicedChord } from '@/lib/progression/types';
import { formatVoicedProgression } from './format';

export function buildEditProgressionMessage(chords: VoicedChord[], feedback: string, prompt?: string): string {
    const progressionStr = formatVoicedProgression(chords);

    let context = `Current progression (each chord's notes in brackets, lowest first): ${progressionStr}`;
    if (prompt?.trim()) {
        context += `\nOriginal creative direction: "${prompt}"`;
    }

    return `${context}

Revise this progression based on the following feedback from the user: "${feedback}"

Apply the requested change(s) faithfully while keeping the result musically coherent. The feedback may be about the harmony, the voicing, or both — if it is only about how the chords sound (brighter, darker, more open, higher, fuller), you may keep the symbols and change just the notes. Keep the chord count exactly the same as the current progression (${chords.length} chords) unless the user's feedback explicitly asks for a different length (the result must stay between 2 and 8 chords). Return the complete revised progression with notes for every chord, not just the changed ones, and make sure changed chords still voice-lead smoothly into their neighbours.`.trim();
}
