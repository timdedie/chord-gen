"use client";

import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { capture, AnalyticsEvent } from "@/lib/analytics/events";
import { docFromChords } from "@/lib/progression/doc";
import { buildMidi, midiFilename } from "@/lib/progression/midi";
import type { ProgressionDoc } from "@/lib/progression/types";

interface MidiDownloaderProps {
    /** Legacy chord list. Ignored when `doc` is supplied. */
    chords?: string[];
    /** The progression document — carries tempo, durations and voicing. */
    doc?: ProgressionDoc;
    prompt: string;
    compact?: boolean;
    variant?: React.ComponentProps<typeof Button>["variant"];
}

const MidiDownloader: React.FC<MidiDownloaderProps> = ({
    chords,
    doc,
    prompt,
    compact = false,
    variant,
}) => {
    // A bare chord list still exports, by adopting the document defaults.
    const exportDoc = useMemo(
        () => doc ?? docFromChords(chords ?? [], { prompt }),
        [doc, chords, prompt],
    );

    // Building the bytes is pure, so it can be derived. The blob URL is not,
    // and is created on click instead — a results page renders several of these
    // and only one is ever downloaded.
    const bytes = useMemo(
        () => (exportDoc.slots.length ? buildMidi(exportDoc) : null),
        [exportDoc],
    );

    if (!bytes) return null;

    const handleDownloadClick = () => {
        const url = URL.createObjectURL(
            new Blob([bytes as BlobPart], { type: "audio/midi" }),
        );

        const link = document.createElement("a");
        link.href = url;
        link.download = midiFilename(exportDoc);
        link.click();
        // Give the browser a tick to start the download before the URL goes away.
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        toast.success("Download Started!", {
            description: "Drag the MIDI file into your DAW to use it.",
        });
        // The activation / "value moment" — user is taking a progression into a DAW.
        capture(AnalyticsEvent.MidiExported, {
            chord_count: exportDoc.slots.length,
            prompt_length: prompt.length,
        });
    };

    return (
        <Button
            variant={variant ?? (compact ? "outline" : "default")}
            size={compact ? "sm" : "default"}
            onClick={handleDownloadClick}
            className="flex items-center gap-1"
        >
            <Download className={compact ? "h-4 w-4" : "h-5 w-5"} />
            {compact ? "MIDI" : "Download MIDI"}
        </Button>
    );
};

export default MidiDownloader;
