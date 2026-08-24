"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import ColumnChordInfo from "./ColumnChordInfo";
import { ChordColor, generateChordColors } from "@/lib/chordColors";
import { cn } from "@/lib/utils";

export interface ChordAlternative {
  chord: string;
  label: string;
}

interface ChordAlternativesProps {
  /** The chord being replaced — shown as the first band, still playable. */
  originalChord: string;
  originalColor: ChordColor;
  /** `null` while the model is still thinking; three options once it answers. */
  alternatives: ChordAlternative[] | null;
  isDarkMode: boolean;
  /** Id of whichever band is currently sounding, so it can flash on press. */
  playingId: string | null;
  idPrefix: string;
  onPlay: (chord: string, id: string) => void;
  onChoose: (chord: string) => void;
  /** Picking the current chord is how you back out — there is no separate close. */
  onKeepOriginal: () => void;
}

/** Tints controls from the band's own text colour rather than app tokens. */
function chipVars(color: ChordColor): React.CSSProperties {
  const onDarkFill = color.text === "hsl(0, 0%, 100%)";
  return {
    color: color.text,
    "--chip-bg": onDarkFill ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.08)",
    "--chip-bg-hover": onDarkFill ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.18)",
    "--chip-ring": onDarkFill ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.16)",
  } as React.CSSProperties;
}

const PILL_CLASS =
  "flex h-7 items-center rounded-full px-3 text-[11px] font-semibold tracking-wide cursor-pointer " +
  "bg-[var(--chip-bg)] hover:bg-[var(--chip-bg-hover)] ring-1 ring-inset ring-[var(--chip-ring)] " +
  "backdrop-blur-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2";

const BAND_SPRING = { type: "spring", stiffness: 260, damping: 30 } as const;

/**
 * The chosen band swallows the other three and becomes the column. Eased out
 * rather than sprung — a spring's overshoot would wobble the chord strip.
 */
const COMMIT_EASE = { duration: 0.42, ease: [0.22, 1, 0.36, 1] } as const;
/**
 * Handing the choice up slightly before the expansion settles lets the panel's
 * fade overlap its own tail, so the big chord label arrives without a beat of
 * dead air.
 */
const COMMIT_MS = 360;

export default function ChordAlternatives({
  originalChord,
  originalColor,
  alternatives,
  isDarkMode,
  playingId,
  idPrefix,
  onPlay,
  onChoose,
  onKeepOriginal,
}: ChordAlternativesProps) {
  // Each alternative keeps the app's root-note colour language, so a swap that
  // changes the root reads as a colour change before you've even played it.
  const altColors = generateChordColors(
    (alternatives ?? []).map((a) => a.chord),
    isDarkMode
  );

  /** Which band is currently expanding to fill the column, if any. */
  const [committedKey, setCommittedKey] = useState<string | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    },
    []
  );

  const commit = (key: string, action: () => void) => {
    if (committedKey) return;
    setCommittedKey(key);
    commitTimer.current = setTimeout(action, COMMIT_MS);
  };

  const isCommitting = committedKey !== null;
  /** flex-grow for a band: 1 normally, and only the winner keeps it on commit. */
  const growth = (key: string) => (isCommitting ? (committedKey === key ? 1 : 0) : 1);

  // Three bands either way: placeholders hold the layout while we wait, so
  // nothing jumps when the chords land.
  const slots = [0, 1, 2];

  return (
    <motion.div
      className={cn(
        "absolute inset-0 z-20 flex flex-col",
        // Once a choice is committing, the panel is an animation, not a control.
        isCommitting && "pointer-events-none"
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      {/* The original — collapses from filling the column to a quarter of it as
          the alternatives grow in beneath it. */}
      <motion.div
        layout
        className="relative min-h-0 cursor-pointer overflow-hidden"
        style={{ backgroundColor: originalColor.bg }}
        // Starts owning the whole column, which is what makes the alternatives
        // read as the chord splitting apart rather than a panel sliding in.
        initial={{ flex: 1 }}
        animate={{ flex: growth("original") }}
        transition={isCommitting ? COMMIT_EASE : BAND_SPRING}
        onClick={() => onPlay(originalChord, `${idPrefix}-original`)}
      >
        <motion.div
          className="absolute inset-0 bg-black pointer-events-none"
          animate={{ opacity: playingId === `${idPrefix}-original` ? 0.18 : 0 }}
          transition={{ duration: 0.15 }}
        />

        <BandContent fadeOut={isCommitting}>
          <BandBody chord={originalChord} color={originalColor} label="Current" />
        </BandContent>

        {/* Same affordance as the alternatives: every band is a choice, and
            choosing the current chord is simply how you keep it. */}
        <BandAction
          color={originalColor}
          label="Keep"
          srLabel={`Keep ${originalChord}`}
          fadeOut={isCommitting}
          onClick={() => commit("original", onKeepOriginal)}
        />
      </motion.div>

      {slots.map((i) => {
        const alt = alternatives?.[i];
        const color = alt ? altColors[i] : originalColor;
        const bandId = `${idPrefix}-alt-${i}`;
        const key = `alt-${i}`;

        return (
          <motion.div
            key={bandId}
            layout
            initial={{ flex: 0 }}
            animate={{ flex: growth(key) }}
            transition={
              isCommitting ? COMMIT_EASE : { ...BAND_SPRING, delay: i * 0.05 }
            }
            className={cn(
              "relative min-h-0 overflow-hidden",
              alt && "cursor-pointer"
            )}
            style={{
              backgroundColor: color.bg,
              // Placeholders sit back a little so the row reads as "not ready".
              opacity: alt ? 1 : 0.45,
            }}
            onClick={alt ? () => onPlay(alt.chord, bandId) : undefined}
          >
            {/* Hairline seam, tinted from the band's own text colour so it
                stays a whisper in both themes. It has no place once this band
                is becoming the whole column. */}
            <motion.div
              className="absolute inset-x-0 top-0 h-px pointer-events-none"
              style={{ backgroundColor: color.text }}
              animate={{ opacity: isCommitting ? 0 : 0.12 }}
              transition={{ duration: 0.2 }}
            />

            {alt ? (
              <>
                <motion.div
                  className="absolute inset-0 bg-black pointer-events-none"
                  animate={{ opacity: playingId === bandId ? 0.18 : 0 }}
                  transition={{ duration: 0.15 }}
                />

                <BandContent fadeOut={isCommitting} enterDelay={0.1 + i * 0.05}>
                  <BandBody chord={alt.chord} color={color} label={alt.label} />
                </BandContent>

                <BandAction
                  color={color}
                  label="Use"
                  srLabel={`Replace ${originalChord} with ${alt.chord}`}
                  enterDelay={0.16 + i * 0.05}
                  fadeOut={isCommitting}
                  onClick={() => commit(key, () => onChoose(alt.chord))}
                />
              </>
            ) : (
              <div className="absolute inset-0 animate-pulse bg-white/20" />
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

/**
 * Wraps a band's label so it can drift in on arrival and clear out again on
 * commit — the winning band hands the chord name over to the column's own
 * full-size display, so its small copy has to be gone by then.
 */
function BandContent({
  children,
  fadeOut,
  enterDelay = 0,
}: {
  children: React.ReactNode;
  fadeOut: boolean;
  enterDelay?: number;
}) {
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: fadeOut ? 0 : 1, y: 0 }}
      transition={
        fadeOut
          ? { duration: 0.16, ease: "easeOut" }
          : { duration: 0.25, delay: enterDelay }
      }
    >
      {children}
    </motion.div>
  );
}

/**
 * Chord symbol over its one-line descriptor, centred as a single block. The
 * right padding clears the action pill so the pair stays optically centred in
 * the space that's actually free.
 */
function BandBody({
  chord,
  color,
  label,
}: {
  chord: string;
  color: ChordColor;
  label?: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pl-4 pr-[68px] pointer-events-none">
      <ColumnChordInfo chord={chord} textColor={color.text} size="sm" />
      {label && (
        <span
          className="max-w-full truncate text-[11px] font-medium leading-none opacity-60"
          style={{ color: color.text }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * The pill that commits a band. Centring lives on the wrapper rather than a
 * translate, because Framer writes its own `transform` onto the button and
 * would otherwise wipe it out.
 */
function BandAction({
  color,
  label,
  srLabel,
  enterDelay = 0,
  fadeOut,
  onClick,
}: {
  color: ChordColor;
  label: string;
  srLabel: string;
  enterDelay?: number;
  fadeOut: boolean;
  onClick: () => void;
}) {
  return (
    <div className="absolute inset-y-0 right-3 z-10 flex items-center pointer-events-none">
      <motion.button
        type="button"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: fadeOut ? 0 : 1, scale: fadeOut ? 0.8 : 1 }}
        transition={
          fadeOut
            ? { duration: 0.14, ease: "easeOut" }
            : {
                type: "spring",
                stiffness: 500,
                damping: 30,
                mass: 0.5,
                delay: enterDelay,
              }
        }
        whileTap={{ scale: 0.92 }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={chipVars(color)}
        className={cn(PILL_CLASS, "pointer-events-auto")}
      >
        <span aria-hidden>{label}</span>
        <span className="sr-only">{srLabel}</span>
      </motion.button>
    </div>
  );
}
