"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MidiNumbers } from "react-piano";
import { Plus} from "lucide-react";
import dynamic from "next/dynamic";
import SearchHeader from "@/components/SearchHeader";
import ChordColumnsContainer from "@/components/ChordColumns/ChordColumnsContainer";

const PianoKeyboard = dynamic(() => import("@/components/PianoKeyboard"), { ssr: false });
import { usePiano } from "@/components/PianoProvider";
import ThinkingMessages from "@/components/ThinkingMessages";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSavedProgressions } from "@/hooks/useSavedProgressions";
import { usePremiumGeneration } from "@/hooks/usePremiumGeneration";
import { capture, AnalyticsEvent } from "@/lib/analytics/events";

interface ProgressionData {
    id: string;
    chords: string[];
    style: string;
}

function ResultsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { loadSamples, areSamplesLoaded, isLoadingSamples } = usePiano();
    const { isSaved, toggleSave, isSignedIn: isSavedSignedIn } = useSavedProgressions();
    const premium = usePremiumGeneration();
    const { consume: consumePremium, refresh: refreshPremium } = premium;

    const [prompt, setPrompt] = useState("");
    const [numChords, setNumChords] = useState(4);
    const [progressions, setProgressions] = useState<ProgressionData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [activeNotes, setActiveNotes] = useState<string[]>([]);
    const [hasInitialized, setHasInitialized] = useState(false);

    // Load samples on mount
    useEffect(() => {
        if (!areSamplesLoaded && !isLoadingSamples) {
            loadSamples();
        }
    }, [areSamplesLoaded, isLoadingSamples, loadSamples]);

    const generateProgressions = useCallback(async (queryPrompt: string, queryNumChords: number, usePremium: boolean = false) => {
        if (!queryPrompt.trim()) return;

        setIsLoading(true);
        setProgressions([]);

        capture(AnalyticsEvent.GenerationRequested, {
            num_chords: queryNumChords,
            premium: usePremium,
            prompt_length: queryPrompt.length,
        });

        // Load samples if not loaded
        if (!areSamplesLoaded && !isLoadingSamples) {
            loadSamples();
        }

        try {
            const res = await fetch("/api/generate-multiple", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: queryPrompt,
                    numChords: queryNumChords,
                    premium: usePremium,
                }),
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                console.error("Generation error:", data.error);
                capture(AnalyticsEvent.GenerationFailed, {
                    status: res.status,
                    error: data.error ?? "unknown",
                    premium: usePremium,
                });
                setIsLoading(false);
                return;
            }

            setProgressions(data.progressions || []);

            if (usePremium) {
                if (data.premiumUsed && !data.unlimitedPremium) {
                    consumePremium();
                } else {
                    refreshPremium();
                }
            }
        } catch (err) {
            console.error("Network error:", err);
            capture(AnalyticsEvent.GenerationFailed, {
                error: "network_error",
                premium: usePremium,
            });
        }

        setIsLoading(false);
    }, [areSamplesLoaded, isLoadingSamples, loadSamples, consumePremium, refreshPremium]);

    // Load from URL params on mount
    useEffect(() => {
        const q = searchParams.get("q");
        const n = searchParams.get("n");

        if (q) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs prompt input from the URL on mount/back-forward navigation
            setPrompt(q);
        }
        if (n) {
            const numVal = parseInt(n, 10);
            if (numVal >= 2 && numVal <= 8) {
                setNumChords(numVal);
            }
        }

        // If we have a query and haven't generated yet, generate
        if (q && !hasInitialized) {
            setHasInitialized(true);
            const usePremium = searchParams.get("premium") === "1";
            generateProgressions(q, n ? parseInt(n, 10) : 4, usePremium);
        }
    }, [searchParams, hasInitialized, generateProgressions]);

    const generateMoreProgressions = useCallback(async () => {
        if (!prompt.trim() || isLoadingMore) return;

        setIsLoadingMore(true);

        capture(AnalyticsEvent.GenerateMoreClicked, {
            num_chords: numChords,
            existing_count: progressions.length,
        });

        try {
            const existingProgressions = progressions.map((p) => ({
                chords: p.chords,
                style: p.style,
            }));

            const res = await fetch("/api/generate-multiple", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    numChords,
                    existingProgressions,
                }),
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                console.error("Generate more error:", data.error);
                setIsLoadingMore(false);
                return;
            }

            setProgressions((prev) => [...prev, ...(data.progressions || [])]);
        } catch (err) {
            console.error("Network error:", err);
        }

        setIsLoadingMore(false);
    }, [prompt, numChords, progressions, isLoadingMore]);

    const handleGenerate = useCallback(() => {
        if (!prompt.trim()) return;

        // Update URL
        const params = new URLSearchParams();
        params.set("q", prompt);
        params.set("n", String(numChords));
        if (premium.enabled) params.set("premium", "1");
        router.push(`/app/results?${params.toString()}`);

        generateProgressions(prompt, numChords, premium.enabled);
    }, [prompt, numChords, router, generateProgressions, premium.enabled]);

    const handleNumChordsChange = useCallback((value: number) => {
        setNumChords(value);
    }, []);

    const handleActiveNotesChange = useCallback((notes: string[]) => {
        setActiveNotes(notes);
    }, []);

    const firstNote = MidiNumbers.fromNote("C3");
    const lastNote = MidiNumbers.fromNote("C5");

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
            {/* Top gradient */}
            <div className="fixed top-0 left-0 md:left-14 right-0 h-12 bg-gradient-to-b from-gray-50 dark:from-black to-transparent pointer-events-none z-20" />

            <SearchHeader
                prompt={prompt}
                setPrompt={setPrompt}
                numChords={numChords}
                onNumChordsChange={handleNumChordsChange}
                onGenerate={handleGenerate}
                isLoading={isLoading}
                premiumSignedIn={premium.isSignedIn}
                premiumAvailable={premium.available}
                premiumLoading={premium.loading}
                premiumEnabled={premium.enabled}
                onPremiumToggle={premium.toggle}
            />

            <main className="container max-w-6xl mx-auto px-4 pt-36 pb-48">
                {isLoading ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-center py-8">
                            <ThinkingMessages />
                        </div>
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="w-full">
                                <Skeleton className="h-[340px] w-full rounded-xl" />
                            </div>
                        ))}
                    </div>
                ) : progressions.length > 0 ? (
                    <div className="space-y-6">
                        {progressions.map((progression) => (
                            <ChordColumnsContainer
                                key={progression.id}
                                id={progression.id}
                                initialChords={progression.chords}
                                style={progression.style}
                                prompt={prompt}
                                onActiveNotesChange={handleActiveNotesChange}
                                isSaved={isSaved}
                                onToggleSave={(saveId, chords) => toggleSave({ id: saveId, chords, style: progression.style, prompt })}
                                isSignedIn={isSavedSignedIn}
                            />
                        ))}
                        {isLoadingMore ? (
                            <>
                                {[1, 2, 3].map((i) => (
                                    <div key={`skeleton-more-${i}`} className="w-full">
                                        <Skeleton className="h-[340px] w-full rounded-xl" />
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div className="flex justify-center pt-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={generateMoreProgressions}
                                    className="h-12 w-12 rounded-full border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 transition-colors"
                                >
                                    <Plus className="h-5 w-5 text-muted-foreground" />
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <p className="text-muted-foreground text-lg">
                            {prompt ? "No progressions generated yet." : "Enter a prompt to generate chord progressions."}
                        </p>
                        {prompt && (
                            <p className="text-muted-foreground text-sm mt-2">
                                Click the generate button to create progressions.
                            </p>
                        )}
                    </div>
                )}
            </main>

            {/* Bottom gradient above piano */}
            <div className="fixed bottom-0 left-0 md:left-14 right-0 h-32 bg-gradient-to-t from-gray-50 dark:from-black to-transparent pointer-events-none z-20" />

            <PianoKeyboard firstNote={firstNote} lastNote={lastNote} activeNotes={activeNotes} />
        </div>
    );
}

export default function ResultsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
        }>
            <ResultsContent />
        </Suspense>
    );
}
