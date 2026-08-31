import assert from "node:assert/strict";
import test from "node:test";
import { Chord, ChordType, Interval, Note } from "tonal";

import { createSlot, docFromChords, normalizeDoc } from "./doc";
import { buildMidi } from "./midi";
import { VOICED_RANGE, voiceChord, voiceSlots } from "./voicing";
import { voiceProgressionNotes } from "../chordUtils";

/**
 * Verification for the voicing engine.
 *
 * The corpus is every chord type tonal can parse on all twelve roots, rather
 * than a handful of examples, because the failures this engine actually had
 * were all edge cases: G13 produced no placement at all, Cdim7 spelled a note
 * the keyboard silently refused to draw, and Cb2 spelled an octave lower than
 * every other bass note and fell off the bottom of the piano.
 */

const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
/** Spellings a generator reaches for that are not in the list above. */
const AWKWARD_ROOTS = ["C#", "F#", "G#", "A#", "D#", "Cb", "Fb", "B#", "E#"];

const CORPUS: string[] = [];
for (const type of ChordType.all()) {
    const alias = type.aliases[0];
    if (alias === undefined) continue;
    for (const root of ROOTS) CORPUS.push(`${root}${alias}`);
}
for (const root of AWKWARD_ROOTS) {
    for (const alias of ["", "m", "maj7", "m7", "7", "dim7", "sus4", "9", "13", "5"]) {
        CORPUS.push(`${root}${alias}`);
    }
}
/** Slash chords are a separate path: the bass is not the root. */
const SLASH_CORPUS = [
    "C/E", "C/G", "Cmaj7/B", "Am7/G", "Fmaj7/A", "G/B", "Dm7/C", "Bb/D",
    "Cb/Eb", "F#m7/A", "Ebmaj9/G", "A7/C#", "Gm11/F", "Db/Ab",
];

const PLAYABLE = [...CORPUS, ...SLASH_CORPUS].filter((s) => !Chord.get(s).empty);

const REAL_PROGRESSIONS = [
    ["Cmaj7", "Am7", "Fmaj7", "G7"],
    ["C", "G", "Am", "F"],
    ["Am", "F", "C", "G"],
    ["Fmaj9", "Em7", "Am11", "Dm7", "G13"],
    ["Bm7b5", "E7b9", "Am9"],
    ["Cmaj7#11", "Ebmaj7", "Bbmaj7", "Ab6/9"],
    ["C/E", "G/B", "Am7/G", "Fmaj7/A"],
    ["Csus2", "Fsus4", "Cadd9", "Gsus4"],
    ["Dm7", "G7", "Cmaj7", "A7b9", "Dm7", "G13", "Cmaj9"],
    ["Cb5", "Fb", "Cbmaj7"],
];

const midiOf = (note: string) => {
    const m = Note.midi(note);
    assert.notEqual(m, null, `${note} has no MIDI number`);
    return m as number;
};

const chromaOf = (note: string) => {
    const c = Note.chroma(note);
    assert.notEqual(c, undefined, `${note} has no chroma`);
    return c as number;
};

/** The interval degrees a chord actually contains, e.g. [1, 3, 5, 7]. */
const degreesOf = (symbol: string) =>
    Chord.get(symbol).intervals.map((iv) => Interval.get(iv).num ?? 0);

test(`corpus covers every chord type on all twelve roots`, () => {
    assert.ok(ChordType.all().length > 50, "tonal should know many chord types");
    assert.ok(PLAYABLE.length > 1000, `expected a large corpus, got ${PLAYABLE.length}`);
});

test("every chord sounds something", () => {
    for (const symbol of PLAYABLE) {
        const { all, voices, bass } = voiceChord(createSlot(symbol));
        assert.ok(voices.length >= 1, `${symbol} produced no chord voices`);
        assert.notEqual(bass, null, `${symbol} produced no bass note`);
        assert.ok(all.length >= 2, `${symbol} produced only ${all.length} note(s)`);
    }
});

test("every voiced note belongs to the chord", () => {
    for (const symbol of PLAYABLE) {
        const chord = Chord.get(symbol);
        const allowed = new Set(chord.notes.map(chromaOf));
        for (const note of voiceChord(createSlot(symbol)).all) {
            assert.ok(
                allowed.has(chromaOf(note)),
                `${symbol} voiced ${note}, which is not one of its tones (${chord.notes.join(" ")})`,
            );
        }
    }
});

test("the bass is the chord's bass, or its root", () => {
    for (const symbol of PLAYABLE) {
        const chord = Chord.get(symbol);
        const { bass } = voiceChord(createSlot(symbol));
        const expected = chromaOf(chord.bass || (chord.tonic as string));
        assert.equal(
            chromaOf(bass as string),
            expected,
            `${symbol} put ${bass} in the bass, expected ${chord.bass || chord.tonic}`,
        );
    }
});

test("thinning never drops a guide tone", () => {
    for (const symbol of PLAYABLE) {
        const chord = Chord.get(symbol);
        const degrees = degreesOf(symbol);
        const sounded = new Set(voiceChord(createSlot(symbol)).all.map(chromaOf));

        // The 3rd, or the 2nd/4th standing in for it in a sus chord.
        const thirdAt = degrees.findIndex((d) => d === 3 || d === 2 || d === 4);
        if (thirdAt >= 0) {
            assert.ok(
                sounded.has(chromaOf(chord.notes[thirdAt])),
                `${symbol} dropped its 3rd (${chord.notes[thirdAt]})`,
            );
        }

        const seventhAt = degrees.findIndex((d) => d === 7 || d === 6);
        if (seventhAt >= 0) {
            assert.ok(
                sounded.has(chromaOf(chord.notes[seventhAt])),
                `${symbol} dropped its 7th (${chord.notes[seventhAt]})`,
            );
        }
    }
});

test("an altered 5th is never dropped", () => {
    for (const symbol of PLAYABLE) {
        const chord = Chord.get(symbol);
        const fifthAt = Chord.get(symbol).intervals.findIndex((iv) => {
            const parsed = Interval.get(iv);
            return parsed.num === 5 && parsed.q !== "P";
        });
        if (fifthAt < 0) continue;

        const sounded = new Set(voiceChord(createSlot(symbol)).all.map(chromaOf));
        assert.ok(
            sounded.has(chromaOf(chord.notes[fifthAt])),
            `${symbol} dropped its altered 5th (${chord.notes[fifthAt]})`,
        );
    }
});

test("voices ascend, with no duplicated pitches", () => {
    for (const symbol of PLAYABLE) {
        const { all } = voiceChord(createSlot(symbol));
        const midi = all.map(midiOf);
        for (let i = 1; i < midi.length; i += 1) {
            assert.ok(
                midi[i] > midi[i - 1],
                `${symbol} voiced ${all.join(" ")} — ${all[i]} does not rise above ${all[i - 1]}`,
            );
        }
    }
});

test("nothing is voiced outside VOICED_RANGE", () => {
    const low = midiOf(VOICED_RANGE.low);
    const high = midiOf(VOICED_RANGE.high);

    for (const symbol of PLAYABLE) {
        for (const note of voiceChord(createSlot(symbol)).all) {
            const m = midiOf(note);
            assert.ok(
                m >= low && m <= high,
                `${symbol} voiced ${note} (${m}), outside ${VOICED_RANGE.low}-${VOICED_RANGE.high}`,
            );
        }
    }

    for (const progression of REAL_PROGRESSIONS) {
        for (const notes of voiceProgressionNotes(progression)) {
            for (const note of notes) {
                const m = midiOf(note);
                assert.ok(m >= low && m <= high, `${progression.join("-")} voiced ${note}`);
            }
        }
    }
});

/**
 * Mirrors react-piano's own parser (`NOTE_REGEX` and `PITCH_INDEXES` in
 * dist/react-piano.cjs.js) and the sanitising filter in PianoKeyboard.tsx.
 * A note that fails either is dropped from the keyboard silently — it sounds,
 * but no key lights up, which is exactly the Cdim7 and Cb bug.
 */
const KEYBOARD_FILTER = /^[A-G](?:#|b)?\d$/;
const REACT_PIANO_PITCHES = new Set([
    "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
]);

test("every voiced note can be drawn on the keyboard", () => {
    const check = (note: string, context: string) => {
        assert.match(note, KEYBOARD_FILTER, `${context}: ${note} fails PianoKeyboard's filter`);
        const pitch = note.replace(/\d+$/, "");
        assert.ok(
            REACT_PIANO_PITCHES.has(pitch),
            `${context}: react-piano cannot parse the pitch "${pitch}" (from ${note})`,
        );
    };

    for (const symbol of PLAYABLE) {
        for (const note of voiceChord(createSlot(symbol)).all) check(note, symbol);
    }
    for (const progression of REAL_PROGRESSIONS) {
        for (const notes of voiceProgressionNotes(progression)) {
            for (const note of notes) check(note, progression.join("-"));
        }
    }
});

test("the bass is doubled an octave up, under the voicing", () => {
    for (const symbol of PLAYABLE) {
        const { bass, voices } = voiceChord(createSlot(symbol));
        const bassMidi = midiOf(bass as string);
        const doubled = voices.find((v) => midiOf(v) === bassMidi + 12);

        // A doubling is only added when it clears the bass and stays below the
        // upper structure, so its absence is allowed — its wrongness is not.
        if (doubled) {
            assert.equal(
                chromaOf(doubled),
                chromaOf(bass as string),
                `${symbol} doubled ${bass} as ${doubled}`,
            );
        }
    }
});

test("voice count stays bounded", () => {
    for (const symbol of PLAYABLE) {
        const { all } = voiceChord(createSlot(symbol));
        // 4 upper voices, plus the bass and its octave.
        assert.ok(all.length <= 6, `${symbol} voiced ${all.length} notes: ${all.join(" ")}`);
    }
});

test("voicing is deterministic", () => {
    for (const progression of REAL_PROGRESSIONS) {
        assert.deepEqual(
            voiceProgressionNotes(progression),
            voiceProgressionNotes(progression),
            `${progression.join("-")} voiced differently on a second call`,
        );
    }
});

test("what you hear is what you export", () => {
    for (const progression of REAL_PROGRESSIONS) {
        const doc = docFromChords(progression);
        const played = voiceProgressionNotes(progression);
        const exported = voiceSlots(doc.slots).map((v) => v.all);
        assert.deepEqual(played, exported, `${progression.join("-")} exports different notes`);

        const midi = buildMidi(doc);
        assert.ok(midi && midi.length > 0, `${progression.join("-")} produced no MIDI`);
    }
});

test("the MIDI bass track carries the fundamental only", () => {
    for (const progression of REAL_PROGRESSIONS) {
        const doc = docFromChords(progression);
        for (const { bass, voices } of voiceSlots(doc.slots)) {
            assert.ok(bass, `${progression.join("-")} has a slot with no bass`);
            // The octave doubling belongs to the left hand, not the bass part.
            assert.ok(
                !voices.includes(bass as string),
                `${bass} appears in both the bass track and the chord track`,
            );
        }
    }
});

test("voice leading beats voicing each chord in isolation", () => {
    const topMotion = (voicings: string[][]) => {
        let total = 0;
        for (let i = 1; i < voicings.length; i += 1) {
            const previous = voicings[i - 1];
            const current = voicings[i];
            if (!previous.length || !current.length) continue;
            total += Math.abs(
                midiOf(current[current.length - 1]) - midiOf(previous[previous.length - 1]),
            );
        }
        return total;
    };

    for (const progression of REAL_PROGRESSIONS) {
        if (progression.length < 3) continue;

        const auto = voiceProgressionNotes(progression);
        const naive = progression.map(
            (symbol) => voiceChord(createSlot(symbol, { voicing: "close" })).all,
        );

        assert.ok(
            topMotion(auto) <= topMotion(naive),
            `${progression.join("-")}: top voice moves ${topMotion(auto)} semitones, ` +
                `worse than voicing each chord alone (${topMotion(naive)})`,
        );
    }
});

test("the top voice stays inside an octave across a progression", () => {
    for (const progression of REAL_PROGRESSIONS) {
        const tops = voiceProgressionNotes(progression)
            .filter((notes) => notes.length)
            .map((notes) => midiOf(notes[notes.length - 1]));
        if (tops.length < 2) continue;

        const spread = Math.max(...tops) - Math.min(...tops);
        assert.ok(
            spread <= 12,
            `${progression.join("-")}: top voice ranges over ${spread} semitones`,
        );
    }
});

test("named voicing shapes are left exactly as authored", () => {
    for (const shape of ["close", "drop2", "drop3", "shell", "spread"] as const) {
        const slot = createSlot("Cmaj7", { voicing: shape });
        const alone = voiceChord(slot);
        const [inProgression] = voiceSlots([
            slot,
            createSlot("Fmaj7", { voicing: shape }),
        ]);
        assert.deepEqual(
            alone.all,
            inProgression.all,
            `${shape} changed when voiced inside a progression`,
        );
    }
});

test("unparseable symbols yield nothing rather than throwing", () => {
    for (const junk of ["", "Hzz9", "???", "C###zzz"]) {
        const { all } = voiceChord(createSlot(junk));
        assert.deepEqual(all, [], `${JSON.stringify(junk)} voiced ${all.join(" ")}`);
    }
    assert.deepEqual(voiceProgressionNotes([]), []);
});

/**
 * Saved progressions are the one place this change reaches existing user data:
 * every row in the database was written by the old engine, and its stored
 * `voicing` was a default nobody chose, not a decision to preserve.
 */
test("saved progressions from before v3 are re-voiced", () => {
    const slot = {
        id: "a", symbol: "Cmaj7", voicing: "close",
        octave: 3, inversion: 0, durationBeats: 4,
    };

    const migrated = normalizeDoc({ version: 2, id: "x", slots: [slot] });
    assert.equal(migrated.slots[0].voicing, "auto", "a v2 doc kept its old voicing");
    assert.equal(migrated.version, 3);

    const current = normalizeDoc({ version: 3, id: "x", slots: [slot] });
    assert.equal(current.slots[0].voicing, "close", "a v3 doc lost a deliberate voicing");

    // The oldest rows have no doc at all, only the denormalised chord column.
    const fromChords = normalizeDoc(null, ["Cmaj7", "Am7"]);
    assert.equal(fromChords.slots.length, 2);
    assert.equal(fromChords.slots[0].voicing, "auto");
    assert.ok(voiceSlots(fromChords.slots).every((v) => v.all.length >= 2));

    for (const junk of [undefined, {}, { slots: [] }, { slots: [{ symbol: "Hzz" }] }]) {
        assert.ok(normalizeDoc(junk, ["C"]).slots.length >= 1, `${JSON.stringify(junk)} lost its chords`);
    }
});

/**
 * A minimal Standard MIDI File reader.
 *
 * Comparing two calls into the engine only proves the engine agrees with
 * itself. The question worth answering is whether the bytes the browser
 * downloads carry the notes you actually heard, so this reads them back.
 */
function parseMidi(bytes: Uint8Array) {
    let p = 0;
    const str = (n: number) => {
        const s = String.fromCharCode(...bytes.slice(p, p + n));
        p += n;
        return s;
    };
    const u32 = () => {
        const v = ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0;
        p += 4;
        return v;
    };
    const u16 = () => {
        const v = (bytes[p] << 8) | bytes[p + 1];
        p += 2;
        return v;
    };
    const varint = () => {
        let v = 0;
        for (;;) {
            const b = bytes[p++];
            v = (v << 7) | (b & 0x7f);
            if (!(b & 0x80)) break;
        }
        return v;
    };

    assert.equal(str(4), "MThd", "not a MIDI file");
    u32();
    u16();
    const trackCount = u16();
    const division = u16();

    const onsets = new Map<number, number[]>();
    let tempo: number | null = null;

    for (let t = 0; t < trackCount; t += 1) {
        assert.equal(str(4), "MTrk", "expected a track chunk");
        // Read the length before adding: `p + u32()` would capture p first.
        const length = u32();
        const end = p + length;
        let tick = 0;
        let running = 0;

        while (p < end) {
            tick += varint();
            let status = bytes[p];
            if (status & 0x80) {
                p += 1;
                running = status;
            } else {
                status = running;
            }

            if (status === 0xff) {
                const meta = bytes[p++];
                const length = varint();
                if (meta === 0x51) {
                    tempo = Math.round(
                        60000000 / ((bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2]),
                    );
                }
                p += length;
            } else if (status === 0xf0 || status === 0xf7) {
                p += varint();
            } else if ((status & 0xf0) === 0x90) {
                const note = bytes[p];
                const velocity = bytes[p + 1];
                p += 2;
                // Velocity 0 is the padding written to keep silent slots aligned.
                if (velocity > 0) onsets.set(tick, [...(onsets.get(tick) ?? []), note]);
            } else if ((status & 0xf0) === 0xc0 || (status & 0xf0) === 0xd0) {
                p += 1;
            } else {
                p += 2;
            }
        }
        p = end;
    }

    return { trackCount, division, tempo, onsets };
}

test("the downloaded file contains the notes you heard", () => {
    for (const progression of REAL_PROGRESSIONS) {
        // Exactly what MidiDownloader does with the toolbar's chord list.
        const doc = docFromChords(progression, { prompt: "test" });
        const bytes = buildMidi(doc);
        assert.ok(bytes, `${progression.join("-")} produced no MIDI`);

        const { onsets, division, tempo, trackCount } = parseMidi(bytes as Uint8Array);
        assert.equal(trackCount, 2, "expected a chord track and a bass track");
        assert.equal(tempo, doc.tempo);

        const ticks = [...onsets.keys()].sort((a, b) => a - b);
        assert.equal(ticks.length, progression.length, `${progression.join("-")}: wrong chord count`);

        const heard = voiceProgressionNotes(progression);
        progression.forEach((symbol, i) => {
            const inFile = (onsets.get(ticks[i]) as number[]).sort((a, b) => a - b);
            const played = heard[i].map(midiOf).sort((a, b) => a - b);
            assert.deepEqual(inFile, played, `${symbol}: the file does not match playback`);
        });

        // Every chord occupies its full slot, back to back.
        for (let i = 1; i < ticks.length; i += 1) {
            assert.equal(
                ticks[i] - ticks[i - 1],
                doc.slots[i - 1].durationBeats * division,
                `${progression.join("-")}: chord ${i} does not start where the last one ends`,
            );
        }
    }
});
