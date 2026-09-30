import type { VoicedChord } from '@/lib/progression/voicing';

/**
 * How a voiced chord reads inside a prompt: `Dm9 [D2 C4 E4 F4 A4]`. The notes
 * are what the model has to voice-lead from, so they travel with the symbol
 * wherever the surrounding progression is shown.
 */
export function formatVoicedChord(chord: VoicedChord): string {
    return chord.notes.length ? `${chord.symbol} [${chord.notes.join(' ')}]` : chord.symbol;
}

export function formatVoicedProgression(chords: VoicedChord[], separator = ' - '): string {
    return chords.map(formatVoicedChord).join(separator);
}

/**
 * Coerce untrusted request chords into voiced chords. Bare strings are still
 * accepted, from clients that predate generated notes, and simply carry none.
 */
export function parseVoicedChords(raw: unknown): VoicedChord[] {
    if (!Array.isArray(raw)) return [];

    return raw.flatMap((item): VoicedChord[] => {
        if (typeof item === 'string') return item.trim() ? [{ symbol: item.trim(), notes: [] }] : [];
        if (!item || typeof item !== 'object') return [];

        const { symbol, notes } = item as { symbol?: unknown; notes?: unknown };
        if (typeof symbol !== 'string' || !symbol.trim()) return [];
        return [{
            symbol: symbol.trim(),
            notes: Array.isArray(notes) ? notes.map(String).slice(0, 12) : [],
        }];
    });
}
