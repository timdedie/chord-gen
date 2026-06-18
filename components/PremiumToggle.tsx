"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { capture, AnalyticsEvent } from "@/lib/analytics/events";

interface PremiumToggleProps {
    isSignedIn: boolean;
    available: boolean;
    enabled: boolean;
    onToggle: () => void;
    disabled?: boolean;
    loading?: boolean;
}

const POP_SPRING = { type: "spring", stiffness: 640, damping: 22, mass: 0.7 } as const;

const PARTICLE_COLORS = ["#93c5fd", "#60a5fa", "#3b82f6", "#bfdbfe", "#ffffff"];

interface Particle {
    x: number;
    y: number;
    size: number;
    color: string;
    duration: number;
    delay: number;
    rotate: number;
}

function makeBurst(count = 14): Particle[] {
    return Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
        const distance = 26 + Math.random() * 22;
        return {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            size: 3 + Math.random() * 4,
            color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
            duration: 0.45 + Math.random() * 0.35,
            delay: Math.random() * 0.06,
            rotate: (Math.random() - 0.5) * 260,
        };
    });
}

export default function PremiumToggle({
    isSignedIn,
    available,
    enabled,
    onToggle,
    disabled,
    loading,
}: PremiumToggleProps) {
    const [burst, setBurst] = useState<{ id: number; particles: Particle[] } | null>(null);
    const reduceMotion = useReducedMotion();

    const clickable = isSignedIn && (available || enabled) && !disabled && !loading;

    useEffect(() => {
        if (!burst) return;
        const t = setTimeout(() => setBurst(null), 1000);
        return () => clearTimeout(t);
    }, [burst]);

    const handleClick = () => {
        if (!clickable) return;
        capture(AnalyticsEvent.PremiumToggled, { enabling: !enabled });
        if (!enabled) {
            if (!reduceMotion) setBurst({ id: Date.now(), particles: makeBurst() });
            navigator.vibrate?.(12);
        }
        onToggle();
    };

    const tooltipText = loading
        ? "Checking premium…"
        : !isSignedIn
            ? "Sign in to unlock premium"
            : enabled
                ? "Premium on — our most powerful model"
                : available
                    ? "Premium — our most powerful model"
                    : "No premium left today";

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <motion.button
                    type="button"
                    onClick={handleClick}
                    disabled={!clickable}
                    aria-pressed={enabled}
                    aria-label="Toggle premium generation"
                    whileHover={clickable ? { scale: 1.05, y: -1 } : undefined}
                    whileTap={clickable ? { scale: 0.85 } : undefined}
                    animate={
                        enabled && !reduceMotion
                            ? { scale: [0.9, 1.12, 1] }
                            : { scale: 1 }
                    }
                    transition={
                        enabled && !reduceMotion
                            ? { duration: 0.5, times: [0, 0.35, 1], ease: "easeOut" }
                            : POP_SPRING
                    }
                    className={cn(
                        "group relative flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-xl border transition-colors duration-300 overflow-visible",
                        enabled
                            ? "border-transparent text-white shadow-lg shadow-blue-600/40"
                            : clickable
                                ? "border-gray-200 dark:border-gray-800 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-500 hover:border-blue-400/70"
                                : loading
                                    ? "border-gray-200 dark:border-gray-800 text-muted-foreground/60 cursor-wait"
                                    : "border-gray-200 dark:border-gray-800 text-muted-foreground/30 cursor-not-allowed"
                    )}
                >
                    {/* Molten cobalt fill when active */}
                    {enabled && (
                        <motion.span
                            className="absolute inset-0 rounded-xl overflow-hidden"
                            initial={reduceMotion ? false : { opacity: 0 }}
                            animate={{
                                opacity: 1,
                                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                            }}
                            transition={{
                                opacity: { duration: 0.2 },
                                backgroundPosition: { duration: 5, repeat: Infinity, ease: "linear" },
                            }}
                            style={{
                                background: "linear-gradient(135deg, #60a5fa, #2563eb, #1d4ed8, #60a5fa)",
                                backgroundSize: "300% 300%",
                            }}
                        >
                            {/* One-shot sheen sweep on ignition */}
                            {!reduceMotion && (
                                <motion.span
                                    className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                                    initial={{ x: "-150%", skewX: -20 }}
                                    animate={{ x: "300%", skewX: -20 }}
                                    transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                                />
                            )}
                        </motion.span>
                    )}

                    {/* Breathing glow while active */}
                    {enabled && !reduceMotion && (
                        <motion.span
                            className="absolute inset-0 rounded-xl pointer-events-none"
                            animate={{
                                boxShadow: [
                                    "0 0 8px rgba(37,99,235,0.25)",
                                    "0 0 20px rgba(37,99,235,0.55)",
                                    "0 0 8px rgba(37,99,235,0.25)",
                                ],
                            }}
                            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                        />
                    )}

                    {/* Ignition effects: flash + shockwave rings */}
                    {burst && (
                        <React.Fragment key={burst.id}>
                            <motion.span
                                className="absolute inset-0 rounded-xl bg-white pointer-events-none"
                                initial={{ opacity: 0.75 }}
                                animate={{ opacity: 0 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                            />
                            <motion.span
                                className="absolute inset-0 rounded-xl border-2 border-blue-400 pointer-events-none"
                                initial={{ opacity: 0.8, scale: 1 }}
                                animate={{ opacity: 0, scale: 1.9 }}
                                transition={{ duration: 0.55, ease: "easeOut" }}
                            />
                            <motion.span
                                className="absolute inset-0 rounded-xl border border-blue-300 pointer-events-none"
                                initial={{ opacity: 0.6, scale: 1 }}
                                animate={{ opacity: 0, scale: 1.5 }}
                                transition={{ duration: 0.45, ease: "easeOut", delay: 0.08 }}
                            />
                            {burst.particles.map((p, i) => (
                                <motion.span
                                    key={i}
                                    className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
                                    style={{
                                        width: p.size,
                                        height: p.size,
                                        backgroundColor: p.color,
                                        marginLeft: -p.size / 2,
                                        marginTop: -p.size / 2,
                                    }}
                                    initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                                    animate={{
                                        x: p.x,
                                        y: p.y,
                                        opacity: 0,
                                        scale: 0.2,
                                        rotate: p.rotate,
                                    }}
                                    transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
                                />
                            ))}
                        </React.Fragment>
                    )}

                    {/* Twinkle invite when a free premium run is waiting */}
                    <motion.span
                        className="relative z-10 flex"
                        animate={
                            loading && !reduceMotion
                                ? { opacity: [0.4, 1, 0.4], rotate: 0, scale: 1 }
                                : available && !enabled && clickable && !reduceMotion
                                    ? { rotate: [0, -12, 10, 0], scale: [1, 1.15, 1, 1] }
                                    : { rotate: 0, scale: 1, opacity: 1 }
                        }
                        transition={
                            loading && !reduceMotion
                                ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                                : available && !enabled && clickable && !reduceMotion
                                    ? { duration: 0.9, repeat: Infinity, repeatDelay: 3.4, ease: "easeInOut" }
                                    : undefined
                        }
                    >
                        {/* Spring-loaded icon morph between states */}
                        <motion.span
                            key={enabled ? "on" : "off"}
                            className="flex"
                            initial={
                                reduceMotion
                                    ? false
                                    : { scale: 0.4, rotate: enabled ? -160 : 90, opacity: 0 }
                            }
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={POP_SPRING}
                        >
                            <Sparkles
                                className={cn("h-5 w-5", enabled && "drop-shadow-sm")}
                                strokeWidth={2.5}
                                fill={enabled ? "currentColor" : "none"}
                            />
                        </motion.span>
                    </motion.span>
                </motion.button>
            </TooltipTrigger>
            <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
    );
}
