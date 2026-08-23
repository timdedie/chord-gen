"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MidiNumbers } from "react-piano";
import dynamic from "next/dynamic";
import SearchHeader from "@/components/SearchHeader";
import ChordColumnsContainer from "@/components/ChordColumns/ChordColumnsContainer";
import GenerateMoreBar from "@/components/GenerateMoreBar";
import FeedbackDivider from "@/components/FeedbackDivider";

const PianoKeyboard = dynamic(() => import("@/components/PianoKeyboard"), { ssr: false });
import { usePiano } from "@/components/PianoProvider";
import ThinkingMessages from "@/components/ThinkingMessages";
import ProgressionSkeleton from "@/components/ChordColumns/ProgressionSkeleton";
import { useSavedProgressions } from "@/hooks/useSavedProgressions";
import { usePremiumGeneration } from "@/hooks/usePremiumGeneration";
import { capture, AnalyticsEvent } from "@/lib/analytics/events";

interface ProgressionData {
    id: string;
    chords: string[];
    style: string;
}

/**
 * One batch of generated progressions, plus the feedback that produced it.
 * Results are stored as an ordered list of rounds (rather than one flat list)
 * so the UI can show where each note took effect, and so the API can be told
 * exactly which chords came after which feedback.
 */
interface RoundData {
    id: string;
    feedback?: string;
    progressions: ProgressionData[];
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
    const [rounds, setRounds] = useState<RoundData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [activeNotes, setActiveNotes] = useState<string[]>([]);
    const [hasInitialized, setHasInitialized] = useState(false);

    const totalProgressions = rounds.reduce((sum, round) => sum + round.progressions.length, 0);

    /**
     * The session so far, in the shape the API takes: which progressions were
     * produced, and the note that produced each batch. Sent with "generate
     * more" and with single-chord inserts alike, so both answer the same notes.
     */
    const historyRounds = useMemo(() => rounds
        .filter((round) => round.progressions.length > 0)
        .map((round) => ({
            feedback: round.feedback,
            progressions: round.progressions.map((p) => ({ chords: p.chords, style: p.style })),
        })), [rounds]);
    const hasFeedback = rounds.some((round) => !!round.feedback);

    // Load samples on mount
    useEffect(() => {
        if (!areSamplesLoaded && !isLoadingSamples) {
            loadSamples();
        }
    }, [areSamplesLoaded, isLoadingSamples, loadSamples]);

    const generateProgressions = useCallback(async (queryPrompt: string, queryNumChords: number, usePremium: boolean = false) => {
        if (!queryPrompt.trim()) return;

        setIsLoading(true);
        setRounds([]);

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

            setRounds([{ id: `round-${Date.now()}`, progressions: data.progressions || [] }]);

            if (typeof data.numChords === "number" && data.numChords >= 2 && data.numChords <= 8) {
                setNumChords(data.numChords);
            }

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

    const generateMoreProgressions = useCallback(async (feedback?: string, pendingRoundId?: string) => {
        if (!prompt.trim() || isLoadingMore) return;

        setIsLoadingMore(true);

        capture(feedback ? AnalyticsEvent.FeedbackSubmitted : AnalyticsEvent.GenerateMoreClicked, {
            num_chords: numChords,
            existing_count: totalProgressions,
            feedback_length: feedback?.length ?? 0,
            feedback_round: rounds.filter((round) => !!round.feedback).length + (feedback ? 1 : 0),
        });

        try {
            // The full history goes in order so the model can see which chords
            // it produced in response to which feedback. The pending round is
            // already excluded — it has no chords yet, and its feedback travels
            // in `feedback`.
            const res = await fetch("/api/generate-multiple", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    numChords,
                    rounds: historyRounds,
                    feedback,
                }),
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                console.error("Generate more error:", data.error);
                capture(AnalyticsEvent.GenerationFailed, {
                    status: res.status,
                    error: data.error ?? "unknown",
                    is_generate_more: true,
                    has_feedback: !!feedback,
                });
                // Roll the optimistic divider back — it promised results that
                // never arrived.
                if (pendingRoundId) {
                    setRounds((prev) => prev.filter((round) => round.id !== pendingRoundId));
                }
                setIsLoadingMore(false);
                return;
            }

            const newProgressions: ProgressionData[] = data.progressions || [];

            // Feedback can change the length ("make it 6 chords"), so follow the
            // count this round actually landed on — later rounds, the skeletons
            // and the header selector all key off it.
            if (typeof data.numChords === "number" && data.numChords >= 2 && data.numChords <= 8) {
                setNumChords(data.numChords);
            }

            setRounds((prev) => (
                pendingRoundId
                    ? prev.map((round) => (
                        round.id === pendingRoundId ? { ...round, progressions: newProgressions } : round
                    ))
                    : [...prev, { id: `round-${Date.now()}`, progressions: newProgressions }]
            ));
        } catch (err) {
            console.error("Network error:", err);
            if (pendingRoundId) {
                setRounds((prev) => prev.filter((round) => round.id !== pendingRoundId));
            }
        }

        setIsLoadingMore(false);
    }, [prompt, numChords, rounds, historyRounds, totalProgressions, isLoadingMore]);

    /**
     * Places the feedback divider on screen in the same commit the composer
     * closes, so the note morphs straight into it and the user sees what the
     * pending progressions are answering while they load.
     */
    const handleSubmitFeedback = useCallback((feedback: string, layoutId: string) => {
        // Mirror the guard in generateMoreProgressions so a rejected request
        // can't leave an orphaned divider behind.
        if (!prompt.trim() || isLoadingMore) return;

        setRounds((prev) => [...prev, { id: layoutId, feedback, progressions: [] }]);
        generateMoreProgressions(feedback, layoutId);
    }, [prompt, isLoadingMore, generateMoreProgressions]);

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
            <div className="fixed top-0 left-0 right-0 h-12 bg-gradient-to-b from-gray-50 dark:from-black to-transparent pointer-events-none z-20 transition-[left] duration-200 md:left-[var(--sidebar-w,3.5rem)]" />

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
                        {[0, 1, 2].map((i) => (
                            <ProgressionSkeleton key={i} index={i} count={numChords} />
                        ))}
                    </div>
                ) : totalProgressions > 0 ? (
                    <div className="space-y-6">
                        {rounds.map((round) => (
                            <React.Fragment key={round.id}>
                                {round.feedback && (
                                    <FeedbackDivider
                                        feedback={round.feedback}
                                        layoutId={round.id}
                                        isPending={round.progressions.length === 0}
                                    />
                                )}
                                {round.progressions.map((progression) => (
                                    <ChordColumnsContainer
                                        key={progression.id}
                                        id={progression.id}
                                        initialChords={progression.chords}
                                        style={progression.style}
                                        prompt={prompt}
                                        history={historyRounds}
                                        onActiveNotesChange={handleActiveNotesChange}
                                        isSaved={isSaved}
                                        onToggleSave={(saveId, chords) => toggleSave({ id: saveId, chords, style: progression.style, prompt })}
                                        isSignedIn={isSavedSignedIn}
                                    />
                                ))}
                            </React.Fragment>
                        ))}
                        {isLoadingMore ? (
                            <>
                                {[0, 1, 2].map((i) => (
                                    <ProgressionSkeleton
                                        key={`skeleton-more-${i}`}
                                        index={i}
                                        count={numChords}
                                    />
                                ))}
                            </>
                        ) : (
                            <GenerateMoreBar
                                onGenerateMore={() => generateMoreProgressions()}
                                onSubmitFeedback={handleSubmitFeedback}
                                disabled={isLoadingMore}
                                hasFeedback={hasFeedback}
                            />
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
            <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-50 dark:from-black to-transparent pointer-events-none z-20 transition-[left] duration-200 md:left-[var(--sidebar-w,3.5rem)]" />

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
