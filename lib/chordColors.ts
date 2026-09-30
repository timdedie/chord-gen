// Hues chosen by hand for each root note to feel musically intuitive
// and visually distinct from neighboring notes.
const ROOT_NOTE_HUES: Record<string, number> = {
  C: 220, // blue
  "C#": 260, Db: 260, // violet
  D: 280, // purple
  "D#": 310, Eb: 310, // magenta
  E: 340, // rose
  F: 15, // red-orange
  "F#": 35, Gb: 35, // orange
  G: 150, // teal
  "G#": 170, Ab: 170, // cyan
  A: 45, // amber
  "A#": 65, Bb: 65, // yellow-green
  B: 190, // sky blue
};

function getRootNote(chord: string): string | null {
  const match = chord.match(/^([A-G](?:#|b)?)/);
  return match ? match[1] : null;
}

function relativeLuminance(h: number, s: number, l: number): number {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  const r = f(0),
    g = f(8),
    b = f(4);

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getTextColor(h: number, s: number, l: number): string {
  const lum = relativeLuminance(h, s, l);
  return lum > 0.35 ? "hsl(0, 0%, 10%)" : "hsl(0, 0%, 100%)";
}

export interface ChordColor {
  bg: string;
  text: string;
  hue: number;
  saturation: number;
  lightness: number;
}

export function generateChordColors(
  chords: string[],
  isDarkMode: boolean
): ChordColor[] {
  if (chords.length === 0) return [];

  const saturation = isDarkMode ? 50 : 65;
  const lightness = isDarkMode ? 35 : 75;
  const defaultHue = 220;

  return chords.map((chord) => {
    const root = getRootNote(chord);
    const hue = root && ROOT_NOTE_HUES[root] !== undefined
      ? ROOT_NOTE_HUES[root]
      : defaultHue;

    const bg = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const text = getTextColor(hue, saturation, lightness);

    return { bg, text, hue, saturation, lightness };
  });
}
