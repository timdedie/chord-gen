"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import type { ProgressionDoc } from "@/lib/progression/types";

export interface SavedProgression {
    id: string;
    chords: string[];
    /** Present on everything read back from the server. */
    doc?: ProgressionDoc;
    style: string;
    prompt: string;
    savedAt: number;
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
        async (progression: Omit<SavedProgression, "savedAt">) => {
            if (!isSignedIn) return;

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
