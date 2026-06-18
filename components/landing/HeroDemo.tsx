"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import { Sparkles, ArrowRight } from "lucide-react";
import { generateChordColors, getChordHue } from "@/lib/chordColors";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/useMounted";

interface SceneChord {
    name: string;
    /** Semitone offsets from C4 over a two-octave (0–23) range */
    notes: number[];
}

interface Scene {
    prompt: string;
    chords: SceneChord[];
}

const SCENES: Scene[] = [
    {
        prompt: "warm nostalgic neo-soul",
        chords: [
            { name: "Cmaj9", notes: [0, 4, 11, 14] },
            { name: "Am11", notes: [9, 14, 16, 19] },
            { name: "Fmaj7", notes: [5, 9, 12, 16] },
            { name: "G13", notes: [7, 11, 16, 21] },
        ],
    },
    {
        prompt: "tense cinematic build",
        chords: [
            { name: "Am(add9)", notes: [9, 12, 16, 23] },
            { name: "Fmaj7♯11", notes: [5, 9, 12, 23] },
            { name: "Dm6", notes: [2, 5, 9, 11] },
            { name: "E7♭9", notes: [4, 8, 11, 17] },
        ],
    },
    {
        prompt: "sunny beach-day pop",
        chords: [
            { name: "C", notes: [0, 4, 7, 12] },
            { name: "G", notes: [7, 11, 14, 19] },
            { name: "Am", notes: [9, 12, 16, 21] },
            { name: "F", notes: [5, 9, 12, 17] },
        ],
    },
];

const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const BLACK_SEMITONES = [
    { st: 1, after: 0 },
    { st: 3, after: 1 },
    { st: 6, after: 3 },
    { st: 8, after: 4 },
    { st: 10, after: 5 },
];
const WHITE_KEYS = [0, 1].flatMap((o) => WHITE_SEMITONES.map((s) => s + 12 * o));
const BLACK_KEYS = [0, 1].flatMap((o) =>
    BLACK_SEMITONES.map((b) => ({ st: b.st + 12 * o, pos: b.after + 7 * o }))
);

const PASSES = 2;

type Phase = "typing" | "thinking" | "playing" | "resetting";

export default function HeroDemo() {
    const reduceMotion = useReducedMotion();
    const { resolvedTheme } = useTheme();
    const mounted = useMounted();
    const [sceneIdx, setSceneIdx] = useState(0);
    const [typedLen, setTypedLen] = useState(0);
    const [phase, setPhase] = useState<Phase>("typing");
    const [step, setStep] = useState(-1);

    const scene = SCENES[sceneIdx];
    const staticMode = !!reduceMotion;
    const isDark = mounted && resolvedTheme === "dark";

    const chordNames = scene.chords.map((c) => c.name);
    const chordColors = generateChordColors(chordNames, isDark);

    useEffect(() => {
        if (staticMode) return;
        let t: ReturnType<typeof setTimeout>;
        if (phase === "typing") {
            t =
                typedLen < scene.prompt.length
                    ? setTimeout(() => setTypedLen((l) => l + 1), 45)
                    : setTimeout(() => setPhase("thinking"), 400);
        } else if (phase === "thinking") {
            t = setTimeout(() => {
                setPhase("playing");
                setStep(0);
            }, 900);
        } else if (phase === "playing") {
            t =
                step < scene.chords.length * PASSES - 1
                    ? setTimeout(() => setStep((s) => s + 1), 850)
                    : setTimeout(() => setPhase("resetting"), 1100);
        } else {
            t = setTimeout(() => {
                setSceneIdx((i) => (i + 1) % SCENES.length);
                setTypedLen(0);
                setStep(-1);
                setPhase("typing");
            }, 450);
        }
        return () => clearTimeout(t);
    }, [phase, typedLen, step, scene, staticMode]);

    const shownPrompt = staticMode ? scene.prompt : scene.prompt.slice(0, typedLen);
    const chipsVisible = staticMode || phase === "playing" || phase === "resetting";
    const activeChord = staticMode
        ? 0
        : phase === "playing" && step >= 0
            ? step % scene.chords.length
            : -1;
    const activeNotes = new Set(activeChord >= 0 ? scene.chords[activeChord].notes : []);

    // Vivid key fill derived from the active chord's root-note hue.
    const activeHue = activeChord >= 0 ? getChordHue(scene.chords[activeChord].name) : null;
    const whiteKeyFill =
        activeHue !== null ? `hsl(${activeHue}, 72%, ${isDark ? 56 : 62}%)` : undefined;
    const blackKeyFill =
        activeHue !== null ? `hsl(${activeHue}, 70%, ${isDark ? 44 : 46}%)` : undefined;

    return (
        <div className="relative mx-auto w-full max-w-2xl">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.45, ease: "easeOut" }}
                className="relative rounded-3xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.18)] dark:shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)] p-4 sm:p-6"
            >
                {/* Prompt bar */}
                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-4 h-12">
                    <Sparkles className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                    <span className="flex-1 truncate text-left text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
                        {shownPrompt}
                        {!staticMode && phase === "typing" && (
                            <span className="animate-caret ml-px inline-block h-4 w-[2px] translate-y-[3px] bg-gray-900 dark:bg-white" />
                        )}
                    </span>
                    <motion.span
                        animate={{ opacity: phase === "thinking" ? [1, 0.5, 1] : 1 }}
                        transition={{ duration: 0.9, repeat: phase === "thinking" ? Infinity : 0 }}
                        className="hidden sm:inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    >
                        Generate
                    </motion.span>
                </div>

                {/* Chord chips / thinking dots */}
                <div className="mt-4 sm:mt-5 flex h-11 items-center justify-center gap-2">
                    <AnimatePresence mode="wait">
                        {!chipsVisible && phase !== "thinking" && (
                            <motion.div
                                key="ghost"
                                exit={{ opacity: 0 }}
                                className="flex gap-2"
                                aria-hidden
                            >
                                {scene.chords.map((_, i) => (
                                    <span
                                        key={i}
                                        className="h-9 w-16 sm:w-20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800"
                                    />
                                ))}
                            </motion.div>
                        )}
                        {phase === "thinking" && (
                            <motion.div
                                key="thinking"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-1.5"
                            >
                                {[0, 1, 2].map((i) => (
                                    <motion.span
                                        key={i}
                                        className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500"
                                        animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                                        transition={{
                                            duration: 0.7,
                                            repeat: Infinity,
                                            delay: i * 0.15,
                                            ease: "easeInOut",
                                        }}
                                    />
                                ))}
                            </motion.div>
                        )}
                        {chipsVisible && (
                            <motion.div
                                key={`chips-${sceneIdx}`}
                                initial="hidden"
                                animate="visible"
                                exit={{ opacity: 0, transition: { duration: 0.25 } }}
                                variants={{
                                    visible: { transition: { staggerChildren: 0.09 } },
                                }}
                                className="flex gap-2"
                            >
                                {scene.chords.map((chord, i) => {
                                    const c = chordColors[i];
                                    const isActive = i === activeChord;
                                    return (
                                        <motion.span
                                            key={chord.name}
                                            variants={{
                                                hidden: { opacity: 0, y: 10, scale: 0.9 },
                                                visible: { opacity: 1, y: 0, scale: 1 },
                                            }}
                                            animate={isActive ? { scale: 1.08, y: -2 } : { scale: 1, y: 0 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 26 }}
                                            className={cn(
                                                "font-mono-accent inline-flex h-9 items-center rounded-xl border px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-colors duration-200",
                                                !isActive &&
                                                    "border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300"
                                            )}
                                            style={
                                                isActive
                                                    ? {
                                                          backgroundColor: c?.bg,
                                                          color: c?.text,
                                                          borderColor: "transparent",
                                                          boxShadow: "0 6px 16px -6px rgba(0,0,0,0.25)",
                                                      }
                                                    : undefined
                                            }
                                        >
                                            {chord.name}
                                        </motion.span>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Mini piano */}
                <div className="relative mt-4 sm:mt-5 h-24 sm:h-32" aria-hidden>
                    <div className="flex h-full gap-[3px]">
                        {WHITE_KEYS.map((st) => {
                            const on = activeNotes.has(st);
                            return (
                                <div
                                    key={st}
                                    className={cn(
                                        "flex-1 rounded-b-md border transition-colors duration-150",
                                        on
                                            ? "border-black/10 shadow-[inset_0_-4px_8px_rgba(0,0,0,0.15)]"
                                            : "border-gray-300 bg-white dark:border-gray-400 dark:bg-gray-200"
                                    )}
                                    style={on ? { backgroundColor: whiteKeyFill } : undefined}
                                />
                            );
                        })}
                    </div>
                    {BLACK_KEYS.map(({ st, pos }) => {
                        const on = activeNotes.has(st);
                        return (
                            <div
                                key={st}
                                className={cn(
                                    "absolute top-0 h-[58%] rounded-b-md transition-colors duration-150",
                                    !on && "bg-gray-900 dark:bg-black border border-gray-700"
                                )}
                                style={{
                                    left: `calc(${pos + 1} * (100% / 14) - (100% / 14) * 0.32)`,
                                    width: `calc((100% / 14) * 0.64)`,
                                    ...(on ? { backgroundColor: blackKeyFill } : {}),
                                }}
                            />
                        );
                    })}
                </div>
            </motion.div>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 1 }}
                className="mt-5 text-sm text-gray-500 dark:text-gray-500"
            >
                A loop of the real flow — type a feeling, get progressions, hear them.{" "}
                <Link
                    href="/app"
                    className="inline-flex items-center gap-1 font-semibold text-gray-900 dark:text-white hover:underline"
                >
                    Try it live <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </motion.p>
        </div>
    );
}
