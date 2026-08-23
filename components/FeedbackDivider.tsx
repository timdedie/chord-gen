"use client";

import React from "react";
import { motion } from "framer-motion";
import { CornerDownRight } from "lucide-react";

interface FeedbackDividerProps {
    feedback: string;
    /**
     * Shared-layout key, matching the composer that submitted this feedback.
     * Lets the note travel from the input into the pill instead of re-appearing.
     */
    layoutId?: string;
    /** True while the progressions under this note are still generating. */
    isPending?: boolean;
}

const MORPH = { type: "spring" as const, stiffness: 420, damping: 36 };

/**
 * Marks the point in the results list where the user's feedback took effect.
 * Everything below it was generated in response to this note.
 */
export default function FeedbackDivider({ feedback, layoutId, isPending = false }: FeedbackDividerProps) {
    return (
        <div className="flex items-center gap-3 pt-2" role="separator">
            <motion.div
                initial={layoutId ? { scaleX: 0, opacity: 0 } : false}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="h-px flex-1 origin-right bg-gray-200 dark:bg-gray-800"
            />

            <motion.div
                layoutId={layoutId ? `${layoutId}-shell` : undefined}
                style={{ borderRadius: 9999 }}
                transition={MORPH}
                className="flex min-w-0 max-w-[70%] items-center gap-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black px-3.5 py-1.5 shadow-sm"
            >
                <motion.div
                    layoutId={layoutId ? `${layoutId}-icon` : undefined}
                    layout="position"
                    transition={MORPH}
                    className="flex-shrink-0 text-muted-foreground"
                >
                    <CornerDownRight className="h-3.5 w-3.5" />
                </motion.div>

                {/* Quotes fade in around the text so the text node itself is
                    character-identical to the input's — it only moves. */}
                <span className="flex min-w-0 items-baseline text-base text-muted-foreground">
                    <motion.span
                        initial={layoutId ? { opacity: 0 } : false}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2, delay: 0.15 }}
                        aria-hidden
                    >
                        &ldquo;
                    </motion.span>
                    <motion.span
                        layoutId={layoutId ? `${layoutId}-text` : undefined}
                        layout="position"
                        transition={MORPH}
                        className="truncate"
                    >
                        {feedback}
                    </motion.span>
                    <motion.span
                        initial={layoutId ? { opacity: 0 } : false}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2, delay: 0.15 }}
                        aria-hidden
                    >
                        &rdquo;
                    </motion.span>
                </span>

                {isPending && (
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                        className="ml-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground"
                        aria-label="Generating"
                    />
                )}
            </motion.div>

            <motion.div
                initial={layoutId ? { scaleX: 0, opacity: 0 } : false}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="h-px flex-1 origin-left bg-gray-200 dark:bg-gray-800"
            />
        </div>
    );
}
