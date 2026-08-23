"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ColumnSpacerProps {
  position: number;
  chordsCount: number;
  addChordAt: (position: number) => void;
}

export default function ColumnSpacer({
  position,
  chordsCount,
  addChordAt,
}: ColumnSpacerProps) {
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const canAdd = chordsCount < 8;

  // Aiming at the seam eases the columns apart and the button resolves into a
  // real control in the space that opens up.
  const isRevealed = (hover || focused) && canAdd;

  // Hover lives on the container, so it covers both the pad and the button
  // itself — the button is a sibling of the pad, not a child of it.
  return (
    <div
      className={cn(
        // Gap only opens on desktop, where the button exists at all.
        // Stacks above the columns so the hit pad below can overhang them.
        "relative z-30 w-1 flex-shrink-0 h-full flex items-center justify-center transition-[width] duration-200 ease-out",
        isRevealed && "md:w-12"
      )}
      onMouseEnter={() => setHover(true)}
      // A click inserts a column under the cursor, so the seam it belonged to
      // is gone; hover is dropped there and only re-armed once the pointer
      // actually moves again over this slot.
      onMouseMove={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* The seam itself is only 4px wide, far too fine to aim at. This
          invisible pad overhangs the neighbouring columns a little so the
          button appears well before the cursor reaches the actual seam, and
          stays up while the cursor travels towards it. Clicking anywhere on it
          adds a chord, so the widened target has no dead edges. */}
      <div
        className={cn(
          "hidden md:block absolute inset-y-0 left-1/2 -translate-x-1/2 z-10 cursor-pointer",
          isRevealed ? "w-16" : "w-10",
          !canAdd && "pointer-events-none"
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (!canAdd) return;
          setHover(false);
          addChordAt(position);
        }}
      />

      {/* Desktop: revealed by hovering at or near the seam */}
      <AnimatePresence>
        {isRevealed && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", stiffness: 480, damping: 30, mass: 0.5 }}
            whileTap={{ scale: 0.9 }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={cn(
              "hidden md:flex absolute h-8 w-8 items-center justify-center rounded-full border bg-background z-20 cursor-pointer",
              "border-border text-foreground shadow-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            )}
            onClick={(e) => {
              // Clicking focuses the button, which would keep it revealed.
              e.currentTarget.blur();
              setHover(false);
              addChordAt(position);
            }}
            aria-label="Add a chord here"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
