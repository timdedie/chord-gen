"use client";

import React, { KeyboardEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CornerDownRight, MessageSquarePlus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const MAX_FEEDBACK_LENGTH = 300;

const MORPH = { type: "spring" as const, stiffness: 420, damping: 36 };

interface GenerateMoreBarProps {
    /** Generate more of the same, no new feedback. */
    onGenerateMore: () => void;
    /**
     * Generate more, steered by this feedback. `layoutId` is this composer's
     * shared-layout key — the caller uses it as the new round's id so the
     * divider can morph out of this input.
     */
    onSubmitFeedback: (feedback: string, layoutId: string) => void;
    disabled?: boolean;
    /** Whether the user has already steered this session — changes the copy. */
    hasFeedback?: boolean;
}

/**
 * The row under the results: generate more variations, or refine them with
 * feedback. The feedback field stays collapsed until asked for, so the default
 * state is still a single, quiet "+".
 */
export default function GenerateMoreBar({
    onGenerateMore,
    onSubmitFeedback,
    disabled = false,
    hasFeedback = false,
}: GenerateMoreBarProps) {
    const [composerId, setComposerId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const isComposing = composerId !== null;

    useEffect(() => {
        if (isComposing) inputRef.current?.focus();
    }, [isComposing]);

    const open = () => {
        // A fresh key per composer, so a later composer can never match the
        // shared-layout id of a divider that is already on screen.
        setComposerId(`fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        setIsSubmitting(false);
    };

    const close = () => {
        setComposerId(null);
        setFeedback("");
        setIsSubmitting(false);
    };

    const submit = () => {
        const trimmed = feedback.trim();
        if (!trimmed || disabled || !composerId) return;
        // Skip the exit animation: the divider takes over this element's
        // position, so fading a copy out on top of it would read as a duplicate.
        setIsSubmitting(true);
        onSubmitFeedback(trimmed, composerId);
        setComposerId(null);
        setFeedback("");
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            submit();
        } else if (e.key === "Escape") {
            e.preventDefault();
            close();
        }
    };

    return (
        <div className="pt-2">
            <AnimatePresence mode="wait" initial={false}>
                {isComposing ? (
                    <motion.div
                        key="composer"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={isSubmitting ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="mx-auto w-full max-w-2xl"
                    >
                        <motion.div
                            layoutId={`${composerId}-shell`}
                            // Inline, not a Tailwind class: framer-motion interpolates
                            // this into the divider pill's 9999 during the morph.
                            // 24 == rounded-3xl, matching PromptBar.
                            style={{ borderRadius: 24 }}
                            transition={MORPH}
                            className="flex items-center gap-2 border border-gray-200 bg-white p-2 pl-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.30)] dark:border-gray-800 dark:bg-black dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.85)]"
                        >
                            <motion.div
                                layoutId={`${composerId}-icon`}
                                layout="position"
                                transition={MORPH}
                                className="flex-shrink-0 text-muted-foreground"
                            >
                                <CornerDownRight className="h-3.5 w-3.5" />
                            </motion.div>

                            <motion.input
                                ref={inputRef}
                                layoutId={`${composerId}-text`}
                                layout="position"
                                transition={MORPH}
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="What should change? e.g. darker, jazzier, stay in A minor..."
                                className="h-11 min-w-0 flex-grow border-0 bg-transparent p-0 text-base outline-none placeholder:text-muted-foreground disabled:opacity-50"
                                aria-label="Feedback for the next progressions"
                                maxLength={MAX_FEEDBACK_LENGTH}
                                disabled={disabled}
                            />

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={close}
                                className="h-11 w-11 flex-shrink-0 rounded-full text-muted-foreground"
                                aria-label="Cancel feedback"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                            <Button
                                onClick={submit}
                                disabled={disabled || !feedback.trim()}
                                className="h-11 w-11 flex-shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                                aria-label="Generate with this feedback"
                            >
                                <ArrowRight className="h-5 w-5" strokeWidth={3} />
                            </Button>
                        </motion.div>
                        <p className="mt-2 text-center text-xs text-muted-foreground">
                            Builds on your prompt and everything generated so far.
                        </p>
                    </motion.div>
                ) : (
                    <motion.div
                        key="actions"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center justify-center gap-3"
                    >
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onGenerateMore}
                            disabled={disabled}
                            className="h-12 w-12 rounded-full border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 transition-colors"
                            aria-label="Generate more progressions"
                            title="Generate more progressions"
                        >
                            <Plus className="h-5 w-5 text-muted-foreground" />
                        </Button>

                        <Button
                            variant="outline"
                            onClick={open}
                            disabled={disabled}
                            className="h-12 gap-2 rounded-full border-2 border-dashed border-muted-foreground/30 px-5 text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground transition-colors"
                        >
                            <MessageSquarePlus className="h-5 w-5" />
                            <span className="text-sm font-medium">
                                {hasFeedback ? "Add more feedback" : "Give feedback"}
                            </span>
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
