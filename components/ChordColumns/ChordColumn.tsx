"use client";

import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { X, GripHorizontal, Pencil } from "lucide-react";
import ColumnChordInfo from "./ColumnChordInfo";
import ChordAlternatives, { ChordAlternative } from "./ChordAlternatives";
import { ChordColor } from "@/lib/chordColors";
import { cn } from "@/lib/utils";

interface ChordColumnProps {
  id: string;
  chord: string;
  color: ChordColor;
  /** Id of whichever chord is currently sounding — a column or one of its alternatives. */
  playingId: string | null;
  loading: boolean;
  isDarkMode: boolean;
  /** True once the user has asked to swap this chord, including while we wait. */
  isReplacing: boolean;
  /** `null` while the alternatives are still being generated. */
  alternatives: ChordAlternative[] | null;
  onPlay: (chord: string, id: string) => void;
  onRemove: () => void;
  onRequestReplace: () => void;
  onCancelReplace: () => void;
  onChooseAlternative: (chord: string) => void;
}

export default function ChordColumn({
  id,
  chord,
  color,
  playingId,
  loading,
  isDarkMode,
  isReplacing,
  alternatives,
  onPlay,
  onRemove,
  onRequestReplace,
  onCancelReplace,
  onChooseAlternative,
}: ChordColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isReplacing });
  const [hover, setHover] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Controls sit on top of a saturated colour, so they are tinted from the
  // column's own text colour rather than the app's neutral tokens.
  const onDarkFill = color.text === "hsl(0, 0%, 100%)";
  const chipStyle = {
    color: color.text,
    "--chip-bg": onDarkFill ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.07)",
    "--chip-bg-hover": onDarkFill ? "rgba(255,255,255,0.26)" : "rgba(0,0,0,0.14)",
    "--chip-ring": onDarkFill ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.16)",
  } as React.CSSProperties;

  const chipClass =
    "bg-[var(--chip-bg)] hover:bg-[var(--chip-bg-hover)] ring-1 ring-inset ring-[var(--chip-ring)] backdrop-blur-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2";

  const isPlaceholder = loading || !chord;
  const controlsVisible = hover && !isDragging && !isReplacing && !isPlaceholder;
  const isPlaying = playingId === id;

  return (
    <motion.div
      ref={setNodeRef}
      layout={!isDragging}
      initial={{ flex: 0, opacity: 0 }}
      // Comparing four chords needs more room than showing one, so the column
      // eases wider while its alternatives are on screen.
      animate={{ flex: isReplacing ? 1.6 : 1, opacity: 1 }}
      exit={{ flex: 0, opacity: 0 }}
      // The fade finishes well before the gap does, so a removed column reads
      // as leaving and then the strip closing over it — not both at once.
      transition={{
        flex: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.18, ease: "easeOut" },
      }}
      style={style}
      className={cn(
        "relative h-full min-w-[120px] md:min-w-0 select-none snap-center overflow-hidden",
        !isReplacing && !isPlaceholder && "cursor-pointer",
        // Wide enough that the chord symbol and its pill never crowd.
        isReplacing && "min-w-[210px]",
        isDragging && "z-50 opacity-80 shadow-2xl"
      )}
      onClick={isReplacing || isPlaceholder ? undefined : () => onPlay(chord, id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Pressed animation — scale down + darken, like a button press */}
      <motion.div
        className="absolute inset-0"
        // `initial={false}` so a column paints its colour immediately on mount
        // but still eases between colours afterwards — an inserted chord
        // resolves out of the placeholder hue instead of snapping to its own.
        initial={false}
        animate={{ scale: isPlaying ? 0.93 : 1, backgroundColor: color.bg }}
        transition={{
          scale: { type: "spring", stiffness: 500, damping: 30 },
          backgroundColor: { duration: 0.5, ease: "easeOut" },
        }}
      >
        <motion.div
          className="absolute inset-0 bg-black pointer-events-none"
          animate={{ opacity: isPlaying ? 0.18 : 0 }}
          transition={{ duration: 0.15 }}
        />

        {/* Waiting on the model: the colour sits back behind a veil of the page
            ground and breathes, then clears as the chord lands. */}
        <motion.div
          className="absolute inset-0 bg-background pointer-events-none"
          initial={false}
          animate={{ opacity: isPlaceholder ? 0.5 : 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
        <AnimatePresence>
          {isPlaceholder && (
            <motion.div
              key="pulse"
              className="absolute inset-0 animate-pulse bg-white/20 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>

        {/* Hover overlay with controls */}
        <AnimatePresence>
          {controlsVisible && (
            <div className="absolute inset-0 z-10 pointer-events-none">
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.5 }}
                whileTap={{ scale: 0.88 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                style={chipStyle}
                className={cn(
                  "absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full cursor-pointer pointer-events-auto",
                  chipClass
                )}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                <span className="sr-only">Remove chord</span>
              </motion.button>

              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  mass: 0.5,
                  delay: 0.03,
                }}
                whileTap={{ scale: 0.88 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestReplace();
                }}
                style={chipStyle}
                className={cn(
                  "absolute top-3 right-12 flex h-7 w-7 items-center justify-center rounded-full cursor-pointer pointer-events-auto",
                  chipClass
                )}
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                <span className="sr-only">Swap this chord for an alternative</span>
              </motion.button>

              {/* Drag handle - only this element triggers drag */}
              <motion.div
                {...attributes}
                {...listeners}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  mass: 0.5,
                  delay: 0.03,
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ ...chipStyle, x: "-50%", y: "-50%" }}
                className={cn(
                  "absolute top-1/2 left-1/2 flex h-7 w-10 items-center justify-center rounded-full cursor-grab active:cursor-grabbing touch-none pointer-events-auto",
                  chipClass
                )}
              >
                <GripHorizontal className="h-4 w-4" />
                <span className="sr-only">Drag to reorder</span>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Chord info anchored to bottom — the replace panel shows its own.
            While waiting, the same slot holds the ghost of the glyph that's
            coming, so the chord resolves in place rather than popping in. */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 pb-6 flex flex-col items-center gap-2 pointer-events-none"
          initial={false}
          animate={{ opacity: isPlaceholder ? 1 : 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <div className="h-9 w-8 md:h-11 md:w-10 rounded-md bg-foreground/10" />
          <div className="h-3 w-5 rounded-full bg-foreground/[0.07]" />
        </motion.div>

        <motion.div
          className="absolute bottom-0 left-0 right-0 pb-6 flex justify-center"
          initial={false}
          animate={{
            opacity: isReplacing || isPlaceholder ? 0 : 1,
            y: isPlaceholder ? 8 : 0,
          }}
          transition={{ duration: 0.32, ease: "easeOut" }}
        >
          <ColumnChordInfo chord={chord} textColor={color.text} />
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isReplacing && (
          <ChordAlternatives
            originalChord={chord}
            originalColor={color}
            alternatives={alternatives}
            isDarkMode={isDarkMode}
            playingId={playingId}
            idPrefix={id}
            onPlay={onPlay}
            onChoose={onChooseAlternative}
            onKeepOriginal={onCancelReplace}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
