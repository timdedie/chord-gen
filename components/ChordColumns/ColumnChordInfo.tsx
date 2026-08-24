"use client";

import React from "react";

interface ColumnChordInfoProps {
  chord: string;
  textColor: string;
  /**
   * "lg" is the full-column display, where the root sits above its suffix.
   * "sm" is used inside the swap panel: four chords share the height of one,
   * so the whole symbol reads on a single baseline instead.
   */
  size?: "lg" | "sm";
}

const replaceAccidentals = (str: string) =>
  str.replace(/b/g, "\u266D").replace(/#/g, "\u266F");

/** Splits a chord into its root and the suffix parts that follow it. */
function splitChord(chord: string) {
  const match = chord.match(/^([A-G](?:#|b)?)(.*)$/);
  const root = match?.[1] ?? chord;
  const suffix = match?.[2] ?? "";
  return {
    root: replaceAccidentals(root),
    parts: suffix.split(/(\d+)/).filter(Boolean),
  };
}

export default function ColumnChordInfo({
  chord,
  textColor,
  size = "lg",
}: ColumnChordInfoProps) {
  const { root, parts } = splitChord(chord);

  if (size === "sm") {
    return (
      <span
        className="flex items-baseline leading-none"
        style={{ color: textColor }}
      >
        <span className="text-[26px] font-bold tracking-tight">{root}</span>
        {parts.map((part, i) =>
          /^\d+$/.test(part) ? (
            <sup key={i} className="text-[13px] font-light">
              {part}
            </sup>
          ) : (
            <span key={i} className="text-[19px] font-light">
              {replaceAccidentals(part)}
            </span>
          )
        )}
      </span>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-1"
      style={{ color: textColor }}
    >
      <span className="text-4xl md:text-5xl font-bold leading-none">{root}</span>
      {/* Fixed-height suffix area so root stays aligned across all columns */}
      <div className="h-7 md:h-8 flex items-start justify-center">
        {parts.length > 0 && (
          <span className="flex items-baseline leading-none">
            {parts.map((part, i) =>
              /^\d+$/.test(part) ? (
                <sup key={i} className="text-lg md:text-xl font-light">
                  {part}
                </sup>
              ) : (
                <span key={i} className="text-xl md:text-2xl font-light">
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
