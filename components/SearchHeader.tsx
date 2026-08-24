"use client";

import React from "react";
import PromptBar from "@/components/PromptBar";

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
    return (
        <div className="fixed top-0 left-0 right-0 z-30 px-4 py-4 transition-[left] duration-200 md:left-[var(--sidebar-w,3.5rem)] md:top-4">
            <div className="container max-w-3xl mx-auto">
                <PromptBar
                    prompt={prompt}
                    onPromptChange={setPrompt}
                    numChords={numChords}
                    onNumChordsChange={onNumChordsChange}
                    onSubmit={onGenerate}
                    disabled={isLoading}
                    size="md"
                    elevated
                    premium={{
                        isSignedIn: premiumSignedIn,
                        available: premiumAvailable,
                        loading: premiumLoading,
                        enabled: premiumEnabled,
                        onToggle: onPremiumToggle,
                    }}
                />
            </div>
        </div>
    );
}
