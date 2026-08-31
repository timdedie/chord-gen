"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import PromptBar from "@/components/PromptBar";
import { useExamplePrompts } from "@/hooks/useExamplePrompts";
import { usePremiumGeneration } from "@/hooks/usePremiumGeneration";
import { usePiano } from "@/components/PianoProvider";
export default function AppPage() {
    const router = useRouter();
    const { randomExamples } = useExamplePrompts();
    const { loadSamples, resumeAudio } = usePiano();
    const premium = usePremiumGeneration();

    const [prompt, setPrompt] = useState("");
    const [numChords, setNumChords] = useState(4);
    const [isNavigating, setIsNavigating] = useState(false);

    const handleGenerate = useCallback(() => {
        if (!prompt.trim()) return;

        // Start the audio here, while we still have the click: the results page
        // is reached by a client-side navigation, so the context resumed now
        // carries over to it.
        void resumeAudio();
        void loadSamples();

        setIsNavigating(true);

        const params = new URLSearchParams();
        params.set("q", prompt);
        params.set("n", String(numChords));
        if (premium.enabled) params.set("premium", "1");
        router.push(`/app/results?${params.toString()}`);
    }, [prompt, numChords, router, loadSamples, resumeAudio, premium.enabled]);

    const handleExampleClick = useCallback((example: string) => {
        void resumeAudio();
        void loadSamples();

        setIsNavigating(true);

        const params = new URLSearchParams();
        params.set("q", example);
        params.set("n", String(numChords));
        router.push(`/app/results?${params.toString()}`);
    }, [numChords, router, loadSamples, resumeAudio]);

    const handleNumChordsChange = useCallback((value: number) => {
        setNumChords(value);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300 selection:bg-primary/70 selection:text-primary-foreground">
            <main className="flex flex-col items-center justify-center w-full px-4 min-h-screen">
                <div className="w-full max-w-3xl">
                    {/* Intro - logo and text side by side */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="flex-shrink-0">
                            <Image
                                src="/chordgen_logo_small.png"
                                alt="ChordGen Logo"
                                width={56}
                                height={56}
                                className="h-14 w-14 dark:invert"
                                priority
                            />
                        </div>

                        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">
                            What should it sound like?
                        </h1>
                    </div>

                    {/* Search bar */}
                    <PromptBar
                        prompt={prompt}
                        onPromptChange={setPrompt}
                        numChords={numChords}
                        onNumChordsChange={handleNumChordsChange}
                        onSubmit={handleGenerate}
                        disabled={isNavigating}
                        autoFocus
                        size="lg"
                        className="mb-6"
                        premium={{
                            isSignedIn: premium.isSignedIn,
                            available: premium.available,
                            loading: premium.loading,
                            enabled: premium.enabled,
                            onToggle: premium.toggle,
                        }}
                    />

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
                                        variant="ghost"
                                        disabled={isNavigating}
                                        onClick={() => handleExampleClick(ex)}
                                        className="h-auto rounded-full border border-gray-200 bg-transparent px-4 py-2 text-sm font-normal text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"
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
