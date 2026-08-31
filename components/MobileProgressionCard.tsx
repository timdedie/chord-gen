"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ChordSymbol from "@/components/ChordSymbol";
import { now as toneNow, type Sampler } from "tone";
import { usePiano } from "@/components/PianoProvider";
import { getVoicedChordNotes } from "@/lib/chordUtils";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const DynamicMarkdownDisplay = dynamic(() => import("@/components/MarkdownDisplay"), {
    loading: () => (
        <div className="flex items-center justify-center h-full">
            <Sparkles className="h-6 w-6 animate-pulse text-blue-600 dark:text-blue-500" />
        </div>
    ),
    ssr: false
});

interface MobileProgressionCardProps {
    id: string;
    initialChords: string[];
    style: string;
    prompt: string;
    onActiveNotesChange: (notes: string[]) => void;
}

export default function MobileProgressionCard({
    id,
    initialChords,
    style,
    prompt,
    onActiveNotesChange,
}: MobileProgressionCardProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playingIndex, setPlayingIndex] = useState<number | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);

    // Explanation state
    const [isExplanationPopoverOpen, setIsExplanationPopoverOpen] = useState(false);
    const [currentExplanationText, setCurrentExplanationText] = useState("");
    const [isExplanationLoading, setIsExplanationLoading] = useState(false);
    const [explanationCache, setExplanationCache] = useState<Map<string, string>>(new Map());
    const explanationAbortControllerRef = useRef<AbortController | null>(null);
    const currentProgressionKeyRef = useRef<string>("");

    const { piano, loadSamples, resumeAudio } = usePiano();
    const playbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heldNotesRef = useRef<string[]>([]);
    /** Notes still sounding from the last single-chord play. */
    const singlePlayNotesRef = useRef<string[]>([]);
    const singlePlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const CHORD_PLAYBACK_INTERVAL = 1200;

    // Playback reads the sampler through a ref so a chord tapped during the
    // very first load can sound immediately — the `piano` state that
    // `loadSamples` sets is still stale inside the handler that awaited it.
    const pianoRef = useRef<Sampler | null>(piano);
    useEffect(() => {
        pianoRef.current = piano;
    }, [piano]);

    /** See ChordColumnsContainer — only ever called from a tap. */
    const ensureInstrument = useCallback(async () => {
        await resumeAudio();
        const instrument = pianoRef.current ?? (await loadSamples({ retry: true }));
        if (instrument) pianoRef.current = instrument;
        return instrument;
    }, [loadSamples, resumeAudio]);

    /** See ChordColumnsContainer — `triggerAttackRelease` can't be released. */
    const releaseSinglePlay = useCallback((instrument: Sampler) => {
        if (singlePlayTimeoutRef.current) {
            clearTimeout(singlePlayTimeoutRef.current);
            singlePlayTimeoutRef.current = null;
        }
        if (singlePlayNotesRef.current.length > 0) {
            instrument.triggerRelease(singlePlayNotesRef.current, toneNow());
            singlePlayNotesRef.current = [];
        }
    }, []);

    const playChordOnce = useCallback(async (chordSymbol: string) => {
        const instrument = await ensureInstrument();
        if (!instrument) return;

        const notesToPlay = getVoicedChordNotes(chordSymbol);
        if (notesToPlay.length === 0) {
            onActiveNotesChange([]);
            return;
        }

        const noteDuration = 0.8;
        onActiveNotesChange(notesToPlay);

        releaseSinglePlay(instrument);
        instrument.triggerAttack(notesToPlay, toneNow() + 0.01);
        singlePlayNotesRef.current = notesToPlay;

        singlePlayTimeoutRef.current = setTimeout(() => {
            singlePlayTimeoutRef.current = null;
            releaseSinglePlay(instrument);
            onActiveNotesChange([]);
        }, noteDuration * 1000);
    }, [ensureInstrument, releaseSinglePlay, onActiveNotesChange]);

    const pauseProgression = useCallback(() => {
        if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;

        const instrument = pianoRef.current;
        if (instrument) {
            if (heldNotesRef.current.length > 0) {
                instrument.triggerRelease(heldNotesRef.current, toneNow());
                heldNotesRef.current = [];
            }
            releaseSinglePlay(instrument);
        }

        setIsPlaying(false);
        setPlayingIndex(null);
        onActiveNotesChange([]);
    }, [releaseSinglePlay, onActiveNotesChange]);

    const playNextChordRef = useRef<(index: number) => void>(() => {});

    const playNextChord = useCallback((index: number) => {
        if (index >= initialChords.length) {
            pauseProgression();
            return;
        }

        const chordSymbol = initialChords[index];
        const instrument = pianoRef.current;
        if (chordSymbol && instrument) {
            setPlayingIndex(index);
            const newNotes = getVoicedChordNotes(chordSymbol);

            if (newNotes.length > 0) {
                if (heldNotesRef.current.length > 0) {
                    instrument.triggerRelease(heldNotesRef.current, toneNow());
                }
                instrument.triggerAttack(newNotes, toneNow());
                heldNotesRef.current = newNotes;
                onActiveNotesChange(newNotes);
            }

            playbackTimeoutRef.current = setTimeout(() => {
                playNextChordRef.current(index + 1);
            }, CHORD_PLAYBACK_INTERVAL);
        } else {
            pauseProgression();
        }
    }, [initialChords, pauseProgression, onActiveNotesChange]);
    useEffect(() => {
        playNextChordRef.current = playNextChord;
    }, [playNextChord]);

    const handleTogglePlayPause = useCallback(async () => {
        if (isPlaying) {
            pauseProgression();
            return;
        }
        if (initialChords.length === 0) return;
        if (!(await ensureInstrument())) return;
        setIsPlaying(true);
        playNextChord(0);
    }, [isPlaying, pauseProgression, playNextChord, initialChords, ensureInstrument]);

    // Explanation functionality
    const fetchAndStreamExplanation = async (progressionKey: string) => {
        if (explanationAbortControllerRef.current) {
            explanationAbortControllerRef.current.abort();
        }
        explanationAbortControllerRef.current = new AbortController();
        setIsExplanationLoading(true);
        let accumulatedText = "";
        setCurrentExplanationText("");

        try {
            const response = await fetch('/api/explain-progression', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chords: initialChords, prompt }),
                signal: explanationAbortControllerRef.current.signal,
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            if (!response.body) throw new Error("Response body is null");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done: readerDone } = await reader.read();
                if (readerDone) break;
                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    accumulatedText += chunk;
                    if (currentProgressionKeyRef.current === progressionKey) {
                        setCurrentExplanationText(prev => prev + chunk);
                    }
                }
            }

            if (currentProgressionKeyRef.current === progressionKey) {
                setExplanationCache(prev => new Map(prev).set(progressionKey, accumulatedText));
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') {
                // Aborted
            } else {
                if (currentProgressionKeyRef.current === progressionKey) {
                    setCurrentExplanationText("Error fetching explanation.");
                }
            }
        } finally {
            if (currentProgressionKeyRef.current === progressionKey) {
                setIsExplanationLoading(false);
            }
            explanationAbortControllerRef.current = null;
        }
    };

    const handleExplainClick = () => {
        if (initialChords.length === 0) return;
        const progressionKey = initialChords.join('-');

        if (isExplanationPopoverOpen && currentProgressionKeyRef.current === progressionKey && !isExplanationLoading) {
            setIsExplanationPopoverOpen(false);
            return;
        }

        currentProgressionKeyRef.current = progressionKey;
        setIsExplanationPopoverOpen(true);

        if (explanationCache.has(progressionKey)) {
            setCurrentExplanationText(explanationCache.get(progressionKey) || "");
            setIsExplanationLoading(false);
        } else {
            setCurrentExplanationText("");
            fetchAndStreamExplanation(progressionKey);
        }
    };

    const onPopoverOpenChange = (open: boolean) => {
        setIsExplanationPopoverOpen(open);
        if (!open && explanationAbortControllerRef.current) {
            explanationAbortControllerRef.current.abort();
        }
    };

    return (
        <Card className="w-full bg-card/50 border border-border/50">
            <CardContent className="p-4">
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleTogglePlayPause}
                            variant="outline"
                            size="icon"
                            className="relative w-9 h-9 rounded-full flex-shrink-0"
                        >
                            {isPlaying ? (
                                <Pause className="h-4 w-4" />
                            ) : (
                                <Play className="h-4 w-4" fill="currentColor" />
                            )}
                        </Button>
                        <h3 className="text-base font-semibold text-foreground">{style}</h3>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="h-8 w-8 p-0"
                    >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </div>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Wrapping chord pills */}
                            <div className="flex flex-wrap gap-2 justify-center">
                                {initialChords.map((chord, index) => (
                                    <button
                                        key={`${id}-mobile-${index}`}
                                        onClick={() => playChordOnce(chord)}
                                        className={cn(
                                            "flex items-center justify-center px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-black transition-all duration-150 active:scale-95 min-w-[64px]",
                                            playingIndex === index && "ring-2 ring-blue-600 dark:ring-blue-500 ring-offset-1 ring-offset-background dark:ring-offset-black"
                                        )}
                                    >
                                        <ChordSymbol chord={chord} className="text-xl [&>span:first-child]:text-xl [&_sup]:text-xs [&_span.text-xl]:text-sm" />
                                    </button>
                                ))}
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                                <Popover open={isExplanationPopoverOpen} onOpenChange={onPopoverOpenChange}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleExplainClick}
                                            disabled={isExplanationLoading}
                                        >
                                            {isExplanationLoading ? (
                                                <Sparkles className="h-4 w-4 mr-1 animate-pulse" />
                                            ) : (
                                                <Sparkles className="h-4 w-4 mr-1" />
                                            )}
                                            Explain
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[280px] p-4" sideOffset={5}>
                                        <h4 className="font-medium leading-none text-sm mb-2">Explanation</h4>
                                        <div className="min-h-[50px] w-full">
                                            {isExplanationLoading && !currentExplanationText && (
                                                <div className="flex items-center justify-center h-full">
                                                    <Sparkles className="h-6 w-6 animate-pulse text-blue-600 dark:text-blue-500" />
                                                </div>
                                            )}
                                            {currentExplanationText && (
                                                <DynamicMarkdownDisplay markdownText={currentExplanationText} />
                                            )}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}
