"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import PromptBar from "@/components/PromptBar";
import { useExamplePrompts } from "@/hooks/useExamplePrompts";

/**
 * The real generator entry point on the marketing homepage.
 *
 * Deliberately does NOT use `usePiano` — PianoProvider only wraps /app via
 * AppShell, and the results page loads samples itself on mount. Premium is
 * likewise omitted here to keep the hero uncluttered for signed-out visitors;
 * the toggle is available on the results page via SearchHeader.
 */
export default function HeroGenerator() {
    const router = useRouter();
    const { randomExamples } = useExamplePrompts(4);

    const [prompt, setPrompt] = useState("");
    const [numChords, setNumChords] = useState(4);
    const [isNavigating, setIsNavigating] = useState(false);

    const go = useCallback(
        (text: string) => {
            if (!text.trim()) return;
            setIsNavigating(true);
            const params = new URLSearchParams();
            params.set("q", text);
            params.set("n", String(numChords));
            router.push(`/app/results?${params.toString()}`);
        },
        [numChords, router]
    );

    return (
        <div className="mx-auto w-full max-w-3xl">
            <PromptBar
                prompt={prompt}
                onPromptChange={setPrompt}
                numChords={numChords}
                onNumChordsChange={setNumChords}
                onSubmit={() => go(prompt)}
                disabled={isNavigating}
                size="lg"
                className="mb-6"
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
                        className="flex flex-wrap justify-center gap-2"
                    >
                        {randomExamples.map((ex) => (
                            <Button
                                key={ex}
                                variant="ghost"
                                disabled={isNavigating}
                                onClick={() => go(ex)}
                                className="h-auto rounded-full border border-gray-200 bg-transparent px-4 py-2 text-sm font-normal text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"
                            >
                                {ex}
                            </Button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
