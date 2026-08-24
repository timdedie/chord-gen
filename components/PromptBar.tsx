"use client";

import React, { type KeyboardEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NumChordsSelector from "@/components/NumChordsSelector";
import PremiumToggle from "@/components/PremiumToggle";
import { cn } from "@/lib/utils";

export interface PromptBarPremium {
    isSignedIn: boolean;
    available: boolean;
    loading: boolean;
    enabled: boolean;
    onToggle: () => void;
}

interface PromptBarProps {
    prompt: string;
    onPromptChange: (value: string) => void;
    numChords: number;
    onNumChordsChange: (value: number) => void;
    onSubmit: () => void;
    disabled?: boolean;
    autoFocus?: boolean;
    /** Omit to hide the premium toggle (e.g. the marketing hero). */
    premium?: PromptBarPremium;
    /** "lg" for the full-page entry points, "md" for the persistent results toolbar. */
    size?: "lg" | "md";
    /**
     * Use for bars that float over page content (the fixed results toolbar).
     * The default ambient shadow is too soft to read as elevated once chord
     * columns are scrolling underneath it.
     */
    elevated?: boolean;
    className?: string;
}

/**
 * The single prompt input used across the marketing hero, the /app entry page,
 * and the results toolbar. Kept in one place so the three stay visually
 * identical — they drifted apart previously.
 */
export default function PromptBar({
    prompt,
    onPromptChange,
    numChords,
    onNumChordsChange,
    onSubmit,
    disabled = false,
    autoFocus = false,
    premium,
    size = "lg",
    elevated = false,
    className,
}: PromptBarProps) {
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
        }
    };

    const lg = size === "lg";

    return (
        <div
            className={cn(
                "flex items-center gap-2 rounded-3xl border border-gray-200 bg-white transition-shadow dark:border-gray-800 dark:bg-black",
                elevated
                    ? "shadow-[0_12px_40px_-12px_rgba(0,0,0,0.30)] focus-within:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.38)] dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.85)]"
                    : "shadow-[0_2px_24px_rgba(0,0,0,0.06)] focus-within:shadow-[0_2px_32px_rgba(0,0,0,0.10)] dark:shadow-[0_2px_24px_rgba(255,255,255,0.04)]",
                lg ? "p-2.5" : "p-2",
                className
            )}
        >
            <Input
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe a mood, style, or genre..."
                className={cn(
                    "flex-grow border-0 bg-transparent px-4 text-lg placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:placeholder:text-gray-500",
                    lg ? "h-14" : "h-12"
                )}
                disabled={disabled}
                aria-label="Describe the chord progression you want"
                maxLength={200}
                autoFocus={autoFocus}
            />

            <div className="hidden flex-shrink-0 sm:block">
                <NumChordsSelector
                    value={numChords}
                    onChange={onNumChordsChange}
                    disabled={disabled}
                    compact
                />
            </div>

            {premium && (
                <PremiumToggle
                    isSignedIn={premium.isSignedIn}
                    available={premium.available}
                    loading={premium.loading}
                    enabled={premium.enabled}
                    onToggle={premium.onToggle}
                    disabled={disabled}
                />
            )}

            <Button
                onClick={onSubmit}
                className={cn(
                    "flex flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90",
                    lg ? "h-11 w-11" : "h-10 w-10"
                )}
                disabled={disabled || !prompt.trim()}
                aria-label="Generate chord progression"
            >
                <ArrowRight className="h-5 w-5" strokeWidth={3} />
            </Button>
        </div>
    );
}
