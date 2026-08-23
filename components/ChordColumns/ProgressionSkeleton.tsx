"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Loading state for a progression card. Rather than a grey block, it draws the
 * card that is coming: the toolbar strip, the column row, and a placeholder
 * where each chord name will land — tinted with the palette's hues so the
 * colour arriving is a resolution of what was already there, not a swap.
 */

// A walk through the palette in `lib/chordColors.ts` that reads as a plausible
// progression: blue -> amber -> teal -> rose -> violet -> yellow-green.
const PLACEHOLDER_HUES = [220, 45, 150, 340, 260, 65, 190, 15];

const COLUMN_STAGGER = 0.09;

interface ColumnsSkeletonProps {
  /** How many columns to draw — match the count being generated. */
  count?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** The column row on its own, for the body of an existing card. */
export function ColumnsSkeleton({
  count = 4,
  className,
  style,
}: ColumnsSkeletonProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn("relative flex w-full overflow-hidden", className)}
      style={{ height: "50vh", minHeight: 300, ...style }}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div className="w-1 flex-shrink-0" />}
          <motion.div
            className={cn(
              "relative h-full flex-1 min-w-[120px] md:min-w-0 overflow-hidden",
              "bg-[hsl(var(--sk-hue),38%,86%)] dark:bg-[hsl(var(--sk-hue),30%,26%)]"
            )}
            style={{ ["--sk-hue" as string]: PLACEHOLDER_HUES[i % PLACEHOLDER_HUES.length] }}
            initial={{ opacity: 0, y: 12 }}
            animate={
              reduceMotion
                ? { opacity: 0.75, y: 0 }
                : { opacity: [0.6, 0.95, 0.6], y: 0 }
            }
            transition={{
              y: { type: "spring", stiffness: 300, damping: 30, delay: i * COLUMN_STAGGER },
              opacity: reduceMotion
                ? { duration: 0.3 }
                : {
                    duration: 2.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * COLUMN_STAGGER,
                  },
            }}
          >
            {/* Where ColumnChordInfo will sit: root glyph + suffix line. */}
            <div className="absolute bottom-0 left-0 right-0 pb-6 flex flex-col items-center gap-2">
              <div className="h-9 w-8 md:h-11 md:w-10 rounded-md bg-foreground/10" />
              <div className="h-3 w-5 rounded-full bg-foreground/[0.07]" />
            </div>
          </motion.div>
        </React.Fragment>
      ))}

      {/* One light sweep across the whole row ties the columns together. */}
      {!reduceMotion && (
        <motion.div
          className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10"
          initial={{ x: "-100%" }}
          animate={{ x: "250%" }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.4 }}
        />
      )}
    </div>
  );
}

interface ProgressionSkeletonProps extends ColumnsSkeletonProps {
  /** Position in a list of skeletons, to stagger their entrance. */
  index?: number;
}

/** The whole card: toolbar strip above the column row. */
export default function ProgressionSkeleton({
  count = 4,
  index = 0,
}: ProgressionSkeletonProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="w-full rounded-xl overflow-hidden border border-border/50 bg-card/50"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 28,
        delay: reduceMotion ? 0 : index * 0.08,
      }}
      aria-busy
      aria-label="Generating a progression"
    >
      {/* Mirrors ColumnToolbar's layout so nothing jumps when chords arrive. */}
      <div className="flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-foreground/[0.07]" />
          <div className="h-3.5 w-28 rounded-full bg-foreground/[0.07]" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-7 w-14 rounded-full bg-foreground/[0.07]" />
          <div className="h-7 w-16 rounded-full bg-foreground/[0.07]" />
          <div className="hidden sm:block h-7 w-14 rounded-full bg-foreground/[0.07]" />
        </div>
      </div>

      <ColumnsSkeleton count={count} />
    </motion.div>
  );
}
