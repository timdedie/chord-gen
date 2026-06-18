"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import MidiWriter from "midi-writer-js";
import { Chord } from "tonal";
import { toast } from "sonner";
import { capture, AnalyticsEvent } from "@/lib/analytics/events";

interface MidiDownloaderProps {
    chords: string[];
    prompt: string;
    compact?: boolean;
    variant?: React.ComponentProps<typeof Button>["variant"];
}

const MidiDownloader: React.FC<MidiDownloaderProps> = ({ chords, prompt, compact = false, variant }) => {
    const [midiUrl, setMidiUrl] = useState<string>("");
    const [hasValidChords, setHasValidChords] = useState<boolean>(false);

    // Builds a Blob URL for the current chords. setState calls here manage
    // the object URL's lifecycle (created/revoked alongside the effect), and
    // midiUrl is intentionally left out of the deps to avoid retriggering
    // this effect when it sets its own state.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!chords || chords.length === 0) {
            if (midiUrl) URL.revokeObjectURL(midiUrl);
            setMidiUrl("");
            setHasValidChords(false);
            return;
        }

        const track = new MidiWriter.Track();
        track.setTimeSignature(4, 4, 24, 8);
        track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 1 }));

        let validChordsFound = false;
        chords.forEach((ch) => {
            const chordData = Chord.get(ch);
            if (chordData.empty || !chordData.notes || chordData.notes.length === 0) {
                console.warn(`Skipping empty or invalid chord for MIDI: ${ch}`);
                return;
            }
            const notes = chordData.notes.map((n) =>
                /\d/.test(n) ? n : `${n}4`
            );
            track.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: "1" }));
            validChordsFound = true;
        });

        if (!validChordsFound) {
            if (midiUrl) URL.revokeObjectURL(midiUrl);
            setMidiUrl("");
            setHasValidChords(false);
            return;
        }

        setHasValidChords(true);
        const writer = new MidiWriter.Writer([track]);
        const blob = new Blob([writer.buildFile() as BlobPart], {
            type: "audio/midi",
        });
        const newUrl = URL.createObjectURL(blob);

        if (midiUrl) {
            URL.revokeObjectURL(midiUrl);
        }
        setMidiUrl(newUrl);

        return () => {
            URL.revokeObjectURL(newUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chords]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleDownloadClick = () => {
        if (!midiUrl || !hasValidChords) {
            toast.error("MIDI Not Ready", {
                description: "No valid chords to download.",
            });
            return;
        }
        toast.success("Download Started!", {
            description: "Drag the MIDI file into your DAW to use it.",
        });
        // The activation / "value moment" — user is taking a progression into a DAW.
        capture(AnalyticsEvent.MidiExported, {
            chord_count: chords.length,
            prompt_length: prompt.length,
        });
    };

    const sanitizePromptForFilename = (text: string) => {
        if (!text) return "prompt";
        return text
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^\w-]+/g, '')
            .substring(0, 50);
    };

    const generateFilename = () => {
        const sanitizedPrompt = sanitizePromptForFilename(prompt);
        if (!chords || chords.length === 0) {
            return `${sanitizedPrompt}_progression.mid`;
        }
        const safeChords = chords.map(chord => chord.replace(/\//g, '-').replace(/\s+/g, '_'));
        return `${sanitizedPrompt}_${safeChords.join('_')}.mid`;
    };

    if (!midiUrl || !hasValidChords) {
        return null;
    }

    return (
        <Button
            asChild
            variant={variant ?? (compact ? "outline" : "default")}
            size={compact ? "sm" : "default"}
            onClick={handleDownloadClick}
        >
            <a
                href={midiUrl}
                download={generateFilename()}
                className="flex items-center gap-1"
            >
                <Download className={compact ? "h-4 w-4" : "h-5 w-5"} />
                {compact ? "MIDI" : "Download MIDI"}
            </a>
        </Button>
    );
};

export default MidiDownloader;