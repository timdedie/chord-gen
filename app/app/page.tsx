"use client";

import React, { useState, useCallback, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight } from "lucide-react";
import NumChordsSelector from "@/components/NumChordsSelector";
import PremiumToggle from "@/components/PremiumToggle";
import { useExamplePrompts } from "@/hooks/useExamplePrompts";
import { usePremiumGeneration } from "@/hooks/usePremiumGeneration";
import { usePiano } from "@/components/PianoProvider";
export default function AppPage() {
    const router = useRouter();
    const { randomExamples } = useExamplePrompts();
    const { loadSamples, areSamplesLoaded, isLoadingSamples } = usePiano();
    const premium = usePremiumGeneration();

    const [prompt, setPrompt] = useState("");
    const [numChords, setNumChords] = useState(4);
    const [isNavigating, setIsNavigating] = useState(false);

    const handleGenerate = useCallback(() => {
        if (!prompt.trim()) return;

        if (!areSamplesLoaded && !isLoadingSamples) loadSamples();

        setIsNavigating(true);

        const params = new URLSearchParams();
        params.set("q", prompt);
        params.set("n", String(numChords));
        if (premium.enabled) params.set("premium", "1");
        router.push(`/app/results?${params.toString()}`);
    }, [prompt, numChords, router, areSamplesLoaded, isLoadingSamples, loadSamples, premium.enabled]);

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleGenerate();
        }
    }, [handleGenerate]);

    const handleExampleClick = useCallback((example: string) => {
        if (!areSamplesLoaded && !isLoadingSamples) loadSamples();

        setIsNavigating(true);

        const params = new URLSearchParams();
        params.set("q", example);
        params.set("n", String(numChords));
        router.push(`/app/results?${params.toString()}`);
    }, [numChords, router, areSamplesLoaded, isLoadingSamples, loadSamples]);

    const handleNumChordsChange = useCallback((value: number) => {
        setNumChords(value);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300 selection:bg-primary/70 selection:text-primary-foreground">
            <main className="flex flex-col items-center justify-center w-full px-4 min-h-screen">
                <div className="w-full max-w-3xl">
                    {/* Animated intro - logo and text side by side */}
                    <div className="flex items-center gap-4 mb-8">
                        {/* Logo animation */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{
                                duration: 0.8,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                            className="flex-shrink-0"
                        >
                            <Image
                                src="/chordgen_logo_small.png"
                                alt="ChordGen Logo"
                                width={56}
                                height={56}
                                className="h-14 w-14 dark:invert"
                                priority
                            />
                        </motion.div>

                        {/* Text animation */}
                        <motion.h1
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white"
                        >
                            What do you want to create?
                        </motion.h1>
                    </div>

                    {/* Search bar */}
                    <div className="flex items-center gap-2 bg-white dark:bg-black rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-2 mb-6">
                        <Input
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Describe a mood, style, or genre..."
                            className="flex-grow h-12 text-lg px-4 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                            disabled={isNavigating}
                            aria-label="Chord progression description"
                            maxLength={200}
                            autoFocus
                        />

                        <div className="flex-shrink-0 hidden sm:block">
                            <NumChordsSelector
                                value={numChords}
                                onChange={handleNumChordsChange}
                                disabled={isNavigating}
                                compact
                            />
                        </div>

                        <PremiumToggle
                            isSignedIn={premium.isSignedIn}
                            available={premium.available}
                            loading={premium.loading}
                            enabled={premium.enabled}
                            onToggle={premium.toggle}
                            disabled={isNavigating}
                        />

                        <Button
                            onClick={handleGenerate}
                            className="h-12 w-12 flex items-center justify-center flex-shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                            disabled={isNavigating || !prompt.trim()}
                            aria-label="Generate Chords"
                        >
                            <ArrowRight className="h-5 w-5" strokeWidth={3} />
                        </Button>
                    </div>

                    {/* Example prompts */}
                    <AnimatePresence>
                        {!isNavigating && (
                            <motion.div
                                key="example-buttons"
                                initial={{ opacity: 1 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                                transition={{ duration: 0.3 }}
                                className="flex flex-wrap gap-2"
                            >
                                {randomExamples.map((ex, i) => (
                                    <Button
                                        key={i}
                                        variant="secondary"
                                        disabled={isNavigating}
                                        onClick={() => handleExampleClick(ex)}
                                        className="hover:scale-[1.01] transition-transform shadow-md bg-white dark:bg-black text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900"
                                    >
                                        {ex}
                                    </Button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
