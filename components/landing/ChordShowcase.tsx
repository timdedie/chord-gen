"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import { Play, Sparkles, Download } from "lucide-react";
import { generateChordColors } from "@/lib/chordColors";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/useMounted";

const replaceAccidentals = (str: string) =>
    str.replace(/b/g, "♭").replace(/#/g, "♯");

function ChordName({ chord, textColor }: { chord: string; textColor: string }) {
    const match = chord.match(/^([A-G](?:#|b)?)(.*)$/);
    const root = match?.[1] ?? chord;
    const suffix = match?.[2] ?? "";
    const parts = suffix.split(/(\d+)/).filter(Boolean);

    return (
        <div className="flex flex-col items-center gap-1" style={{ color: textColor }}>
            <span className="text-4xl font-bold leading-none sm:text-5xl md:text-6xl">
                {replaceAccidentals(root)}
            </span>
            <div className="flex h-7 items-start justify-center md:h-8">
                {parts.length > 0 && (
                    <span className="flex items-baseline leading-none">
                        {parts.map((part, i) =>
                            /^\d+$/.test(part) ? (
                                <sup key={i} className="text-lg font-light md:text-xl">
                                    {part}
                                </sup>
                            ) : (
                                <span key={i} className="text-xl font-light md:text-2xl">
                                    {replaceAccidentals(part)}
                                </span>
                            )
                        )}
                    </span>
                )}
            </div>
        </div>
    );
}

interface ChordShowcaseProps {
    prompt: string;
    title: string;
    chords: string[];
}

/**
 * A static, non-interactive replica of a real progression card from the app —
 * the same full-height pastel columns, colored by each chord's root note.
 */
export default function ChordShowcase({ prompt, title, chords }: ChordShowcaseProps) {
    const { resolvedTheme } = useTheme();
    const reduceMotion = useReducedMotion();
    const mounted = useMounted();

    const isDark = mounted && resolvedTheme === "dark";
    const colors = generateChordColors(chords, isDark);

    return (
        <div className="mx-auto w-full max-w-3xl">
            <p className="mb-3 pl-1 text-sm text-gray-500 dark:text-gray-500">
                Prompt: <span className="text-gray-700 dark:text-gray-300">{prompt}</span>
            </p>

            <div className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-[0_24px_80px_-28px_rgba(0,0,0,0.2)] dark:border-gray-800 dark:bg-gray-900 dark:shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)]">
                {/* Card header — mirrors the real app toolbar, without the controls */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
                    <div className="flex items-center gap-2.5">
                        <Play className="h-4 w-4 fill-current text-gray-900 dark:text-white" />
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {title}
                        </span>
                    </div>
                    <div className="hidden items-center gap-4 text-xs font-medium text-gray-400 sm:flex dark:text-gray-500">
                        <span className="inline-flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" /> Explain
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Download className="h-3.5 w-3.5" /> MIDI
                        </span>
                    </div>
                </div>

                {/* Colored columns */}
                <div className="flex h-56 w-full sm:h-72">
                    {chords.map((chord, i) => {
                        const color = colors[i];
                        return (
                            <motion.div
                                key={`${chord}-${i}`}
                                initial={reduceMotion ? false : { opacity: 0, flex: 0 }}
                                whileInView={{ opacity: 1, flex: 1 }}
                                viewport={{ once: true, margin: "-80px" }}
                                transition={{
                                    duration: 0.5,
                                    delay: 0.06 * i,
                                    ease: [0.16, 1, 0.3, 1],
                                }}
                                className={cn(
                                    "relative flex flex-1 items-end justify-center pb-6",
                                    i !== chords.length - 1 && "border-r border-black/5"
                                )}
                                style={{ backgroundColor: color?.bg }}
                            >
                                <ChordName chord={chord} textColor={color?.text ?? "#111"} />
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
