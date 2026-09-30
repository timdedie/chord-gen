import assert from "node:assert/strict";
import test from "node:test";
import { Note } from "tonal";

import { buildMidi } from "./midi";
import { readStoredChords, validateVoicing, type VoicedChord } from "./voicing";
import { VoicedChordSchema } from "../schemas";

/**
 * Voicings come from the model now, with full musical freedom, so the thing to
 * verify is the gate: anything playable passes untouched — colour tones
 * included — and anything unplayable is caught with a message the model can
 * act on.
 */

const ok = (symbol: string, notes: string[]) => {
    const result = validateVoicing(symbol, notes);
    assert.ok(result.ok, `${symbol} [${notes.join(" ")}] was rejected: ${result.ok ? "" : result.error}`);
    return result.notes;
};

const rejected = (symbol: string, notes: string[], mentions: RegExp) => {
    const result = validateVoicing(symbol, notes);
    assert.ok(!result.ok, `${symbol} [${notes.join(" ")}] should have been rejected`);
    assert.match(result.error, mentions);
};

test("idiomatic voicings pass", () => {
    ok("Dm9", ["D2", "C4", "E4", "F4", "A4"]);
    // Rootless above the bass, no 5th — the usual jazz shape.
    ok("G13", ["G2", "F3", "B3", "E4"]);
    ok("Cmaj7", ["C2", "G3", "B3", "E4"]);
    ok("C/E", ["E2", "G3", "C4", "E4"]);
    ok("Am7/G", ["G2", "C4", "E4", "A4"]);
    ok("C7b9", ["C2", "E3", "Bb3", "Db4"]);
    ok("Csus4", ["C2", "F3", "G3", "C4"]);
    ok("C5", ["C2", "G2", "C3"]);
    ok("Bm7b5", ["B1", "A3", "D4", "F4"]);
});

test("colour tones beyond the symbol are the model's call", () => {
    // A 9th on a plain m7 and maj7 — what a player adds without being told.
    ok("Dm7", ["D2", "C4", "E4", "F4", "A4"]);
    ok("Fmaj7", ["F2", "E3", "G3", "A3", "C4"]);
    // Rootless, 3rd-less, or a non-root bass: all voicing decisions, not errors.
    ok("Cmaj7", ["C2", "G3", "B3", "D4"]);
    ok("Cmaj7", ["E2", "B3", "D4", "G4"]);
    ok("C", ["C2", "G2"]);
    // High top voices, which C6 used to reject.
    ok("Cm9", ["C2", "Bb3", "Eb4", "G4", "D6"]);
});

test("notes come back sorted, deduplicated and plainly spelled", () => {
    assert.deepEqual(ok("Cmaj7", ["E4", "C2", "B3", "E4", "G3"]), ["C2", "G3", "B3", "E4"]);
    // Cb and E# would never light a key; the pitch is kept, the spelling is not.
    assert.deepEqual(ok("Abm", ["Ab2", "Cb4", "Eb4"]), ["Ab2", "B3", "Eb4"]);
    assert.deepEqual(ok("C#", ["C#2", "E#3", "G#3"]), ["C#2", "F3", "G#3"]);
    assert.deepEqual(ok("Am", ["a2", "c4", "e4"]), ["A2", "C4", "E4"]);
});

test("unplayable voicings are caught and explained", () => {
    rejected("C", ["C2"], /2-10 different notes/);
    rejected("C", ["C2", "C2"], /2-10 different notes/);
    rejected("C", ["C1", "E3", "G3"], /outside the playable range/);
    rejected("C", ["C2", "E3", "D7"], /outside the playable range/);
    rejected("C", ["C2", "E3", "G"], /"G" is not a pitched note/);
    rejected("C", ["C2", "E3", "H3"], /not a pitched note/);
});

test("the schema repairs the symbol, then checks the notes", () => {
    const parsed = VoicedChordSchema.safeParse({ symbol: "C△7", notes: ["C2", "B3", "E4", "G4"] });
    assert.ok(parsed.success);
    assert.equal(parsed.data.symbol, "Cmaj7");
    assert.deepEqual(parsed.data.notes, ["C2", "B3", "E4", "G4"]);

    const bad = VoicedChordSchema.safeParse({ symbol: "Cmaj7", notes: ["C2", "B3", "E"] });
    assert.ok(!bad.success);
    assert.deepEqual(bad.error.issues[0].path, ["notes"]);
    assert.match(bad.error.issues[0].message, /"E" is not a pitched note/);

    // The output parses again unchanged, so re-validation downstream is safe.
    const again = VoicedChordSchema.safeParse(parsed.data);
    assert.ok(again.success);
    assert.deepEqual(again.data, parsed.data);
});

const PROGRESSION: VoicedChord[] = [
    { symbol: "Dm9", notes: ["D2", "C4", "E4", "F4", "A4"] },
    { symbol: "G13", notes: ["G2", "F3", "B3", "E4"] },
    { symbol: "Cmaj7", notes: ["C2", "G3", "B3", "E4"] },
    { symbol: "A7b9", notes: ["A2", "G3", "C#4", "Bb4"] },
];

test("stored chords keep their notes, and nothing invents notes for older rows", () => {
    const stored = JSON.parse(JSON.stringify(PROGRESSION));
    assert.deepEqual(readStoredChords(stored), PROGRESSION);

    // Unplayable notes do not survive a round trip.
    stored[0].notes = ["D2", "not-a-note", "F4"];
    assert.deepEqual(readStoredChords(stored)[0], { symbol: "Dm9", notes: [] });

    // The older document format kept chords under `slots`.
    const legacyDoc = { version: 4, slots: [{ id: "a", symbol: "G13", notes: ["G2", "F3", "B3", "E4"], durationBeats: 4 }] };
    assert.deepEqual(readStoredChords(legacyDoc), [{ symbol: "G13", notes: ["G2", "F3", "B3", "E4"] }]);
    assert.deepEqual(readStoredChords({ version: 3, slots: [{ symbol: "Am7" }] }), [{ symbol: "Am7", notes: [] }]);

    // Rows saved before any of this have only the symbol column.
    assert.deepEqual(readStoredChords(null, ["Cmaj7", "Am7"]), [
        { symbol: "Cmaj7", notes: [] },
        { symbol: "Am7", notes: [] },
    ]);
});

test("the downloaded file contains exactly the model's notes, one bar each", () => {
    const bytes = buildMidi(PROGRESSION);
    assert.ok(bytes);

    const { onsets, division, tempo, trackCount } = parseMidi(bytes as Uint8Array);
    assert.equal(trackCount, 2, "expected a chord track and a bass track");
    assert.equal(tempo, 90);

    const ticks = [...onsets.keys()].sort((a, b) => a - b);
    assert.equal(ticks.length, PROGRESSION.length);

    PROGRESSION.forEach((chord, i) => {
        const inFile = (onsets.get(ticks[i]) as number[]).sort((a, b) => a - b);
        assert.deepEqual(inFile, chord.notes.map((n) => Note.midi(n)), `${chord.symbol}: file does not match`);
        if (i > 0) assert.equal(ticks[i] - ticks[i - 1], 4 * division);
    });

    assert.equal(buildMidi([{ symbol: "C", notes: [] }]), null);
});

/**
 * A minimal Standard MIDI File reader.
 *
 * The question worth answering is whether the bytes the browser downloads
 * carry the notes you actually heard, so this reads them back.
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

