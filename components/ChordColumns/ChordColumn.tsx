"use client";

import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { X, GripHorizontal } from "lucide-react";
import ColumnChordInfo from "./ColumnChordInfo";
import { ChordColor } from "@/lib/chordColors";
import { cn } from "@/lib/utils";

interface ChordColumnProps {
  id: string;
  chord: string;
  color: ChordColor;
  isPlaying: boolean;
  loading: boolean;
  onPlay: () => void;
  onRemove: () => void;
}

export default function ChordColumn({
  id,
  chord,
  color,
  isPlaying,
  loading,
  onPlay,
  onRemove,
}: ChordColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
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

  const controlsVisible = hover && !isDragging;

  if (loading || !chord) {
    return (
      <motion.div
        layout
        initial={{ flex: 0 }}
        animate={{ flex: 1 }}
        exit={{ flex: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="relative h-full min-w-[120px] md:min-w-0 snap-center overflow-hidden"
        style={{ backgroundColor: color.bg, opacity: 0.5 }}
      >
        <div className="absolute inset-0 animate-pulse bg-white/20" />
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={setNodeRef}
      layout={!isDragging}
      initial={{ flex: 0, opacity: 0 }}
      animate={{ flex: 1, opacity: 1 }}
      exit={{ flex: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      style={style}
      className={cn(
        "relative h-full min-w-[120px] md:min-w-0 cursor-pointer select-none snap-center overflow-hidden",
        isDragging && "z-50 opacity-80 shadow-2xl"
      )}
      onClick={onPlay}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Pressed animation — scale down + darken, like a button press */}
      <motion.div
        className="absolute inset-0"
        animate={{ scale: isPlaying ? 0.93 : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{ backgroundColor: color.bg }}
      >
        <motion.div
          className="absolute inset-0 bg-black pointer-events-none"
          animate={{ opacity: isPlaying ? 0.18 : 0 }}
          transition={{ duration: 0.15 }}
        />

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

        {/* Chord info anchored to bottom */}
        <div className="absolute bottom-0 left-0 right-0 pb-6 flex justify-center">
          <ColumnChordInfo chord={chord} textColor={color.text} />
        </div>
      </motion.div>
    </motion.div>
  );
}
