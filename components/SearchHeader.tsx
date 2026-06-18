"use client";

import React, { KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight } from "lucide-react";
import NumChordsSelector from "@/components/NumChordsSelector";
import PremiumToggle from "@/components/PremiumToggle";

interface SearchHeaderProps {
    prompt: string;
    setPrompt: (value: string) => void;
    numChords: number;
    onNumChordsChange: (value: number) => void;
    onGenerate: () => void;
    isLoading: boolean;
    premiumSignedIn: boolean;
    premiumAvailable: boolean;
    premiumLoading: boolean;
    premiumEnabled: boolean;
    onPremiumToggle: () => void;
}

export default function SearchHeader({
    prompt,
    setPrompt,
    numChords,
    onNumChordsChange,
    onGenerate,
    isLoading,
    premiumSignedIn,
    premiumAvailable,
    premiumLoading,
    premiumEnabled,
    onPremiumToggle,
}: SearchHeaderProps) {
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            onGenerate();
        }
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-30 px-4 py-4 transition-[left] duration-200 md:left-[var(--sidebar-w,3.5rem)] md:top-4">
            <div className="container max-w-3xl mx-auto">
                <div className="flex items-center gap-2 bg-white dark:bg-black rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-2">
                    {/* Search input */}
                    <Input
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe a mood, style, or genre..."
                        className="flex-grow h-12 text-lg px-4 border-0 bg-transparent dark:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                        disabled={isLoading}
                        aria-label="Chord progression description"
                        maxLength={200}
                    />

                    {/* Chord count selector */}
                    <div className="flex-shrink-0 hidden sm:block">
                        <NumChordsSelector
                            value={numChords}
                            onChange={onNumChordsChange}
                            disabled={isLoading}
                            compact
                        />
                    </div>

                    <PremiumToggle
                        isSignedIn={premiumSignedIn}
                        available={premiumAvailable}
                        loading={premiumLoading}
                        enabled={premiumEnabled}
                        onToggle={onPremiumToggle}
                        disabled={isLoading}
                    />

                    <Button
                        onClick={onGenerate}
                        className="h-12 w-12 flex items-center justify-center flex-shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                        disabled={isLoading}
                        aria-label="Generate Chords"
                    >
                        <ArrowRight className="h-5 w-5" strokeWidth={3} />
                    </Button>
                </div>
            </div>
        </div>
    );
}
