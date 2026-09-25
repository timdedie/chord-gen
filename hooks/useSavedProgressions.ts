"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { docFromChords } from "@/lib/progression/doc";
import type { ProgressionDoc, VoicedChord } from "@/lib/progression/types";

export interface SavedProgression {
    id: string;
    chords: string[];
    /** Carries the notes — `chords` only has the symbols. */
    doc: ProgressionDoc;
    style: string;
    prompt: string;
    savedAt: number;
}

/** What a card hands over to save: its chords as voiced, not just their symbols. */
export interface SaveRequest {
    id: string;
    chords: VoicedChord[];
    style: string;
    prompt: string;
}

export function useSavedProgressions() {
    const { isSignedIn, isLoaded } = useUser();
    const [saved, setSaved] = useState<SavedProgression[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isLoaded || !isSignedIn) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount loading flag
        setIsLoading(true);
        fetch("/api/saved")
            .then((r) => r.json())
            .then((data) => setSaved(data.progressions ?? []))
            .catch(() => {})
            .finally(() => setIsLoading(false));
    }, [isLoaded, isSignedIn]);

    // Treat saved progressions as empty once the user is signed out, without
    // discarding the fetched state (it's reused if they sign back in).
    const effectiveSaved = useMemo(() => (isSignedIn ? saved : []), [isSignedIn, saved]);

    const isSaved = useCallback(
        (id: string) => effectiveSaved.some((p) => p.id === id),
        [effectiveSaved]
    );

    const toggleSave = useCallback(
        async ({ id, chords: voiced, style, prompt }: SaveRequest) => {
            if (!isSignedIn) return;

            // The doc is what keeps the notes: the `chords` column only has
            // room for symbols.
            const progression: Omit<SavedProgression, "savedAt"> = {
                id,
                chords: voiced.map((c) => c.symbol),
                doc: docFromChords(voiced, { id, prompt, style }),
                style,
                prompt,
            };

            const alreadySaved = saved.some((p) => p.id === progression.id);
            if (alreadySaved) {
                // Optimistic remove
                setSaved((prev) => prev.filter((p) => p.id !== progression.id));
                await fetch("/api/saved", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: progression.id }),
                });
            } else {
                // Optimistic add
                const newEntry: SavedProgression = { ...progression, savedAt: Date.now() };
                setSaved((prev) => [...prev, newEntry]);
                await fetch("/api/saved", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(progression),
                });
            }
        },
        [isSignedIn, saved]
    );

    return { saved: effectiveSaved, isSaved, toggleSave, isLoading, isSignedIn: isSignedIn ?? false };
}
