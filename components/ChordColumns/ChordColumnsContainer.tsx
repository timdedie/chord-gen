"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { ChordItem } from "@/hooks/useChordManagement";
import type { GenerationRound } from "@/lib/prompts/history";
import { ColumnsSkeleton } from "./ProgressionSkeleton";
import { Chord } from "tonal";
import { now as toneNow } from "tone";
import { usePiano } from "@/components/PianoProvider";
import { getVoicedChordNotes } from "@/lib/chordUtils";
import { generateChordColors } from "@/lib/chordColors";
import { useTheme } from "next-themes";
import ChordColumn from "./ChordColumn";
import type { ChordAlternative } from "./ChordAlternatives";
import ColumnSpacer from "./ColumnSpacer";
import ColumnToolbar from "./ColumnToolbar";

const generateUniqueId = () =>
  `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const EMPTY_CHORDS: ChordItem[] = [];

interface ChordColumnsContainerProps {
  id: string;
  initialChords: string[];
  style: string;
  prompt: string;
  onActiveNotesChange: (notes: string[]) => void;
  onChordPlay?: (chord: string) => void;
  isSaved?: (id: string) => boolean;
  onToggleSave?: (id: string, chords: string[]) => void;
  isSignedIn?: boolean;
  /**
   * Everything generated in this session so far, with the feedback that drove
   * each round. Passed along when inserting a chord so the new chord answers
   * the same notes the rest of the progression does.
   */
  history?: GenerationRound[];
}

export default function ChordColumnsContainer({
  id,
  initialChords,
  style,
  prompt,
  onActiveNotesChange,
  onChordPlay,
  isSaved,
  onToggleSave,
  isSignedIn = false,
  history,
}: ChordColumnsContainerProps) {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  const [iterations, setIterations] = useState<ChordItem[][]>(() => [
    initialChords.map((chord, index) => ({
      id: `${id}-chord-${index}-${generateUniqueId()}`,
      chord,
    })),
  ]);
  const [currentIteration, setCurrentIteration] = useState(0);
  /**
   * The note that produced each iteration, index-aligned with `iterations`.
   * Iteration 0 came straight from the generator, so it has none.
   */
  const [iterationFeedback, setIterationFeedback] = useState<(string | undefined)[]>([undefined]);
  const [loadingIterationIndex, setLoadingIterationIndex] = useState<number | null>(null);

  const chords = iterations[currentIteration] ?? EMPTY_CHORDS;
  const saveId = currentIteration === 0 ? id : `${id}-iter-${currentIteration}`;

  const setChords = useCallback(
    (updater: ChordItem[] | ((prev: ChordItem[]) => ChordItem[])) => {
      setIterations((prev) => {
        const current = prev[currentIteration] ?? [];
        const next =
          typeof updater === "function"
            ? (updater as (p: ChordItem[]) => ChordItem[])(current)
            : updater;
        const copy = [...prev];
        copy[currentIteration] = next;
        return copy;
      });
    },
    [currentIteration]
  );

  const [loadingChordId, setLoadingChordId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingChordId, setPlayingChordId] = useState<string | null>(null);

  /**
   * Replace-a-chord state. Only one column can be open at a time — comparing
   * four options is already the busiest the strip gets. `replaceOptions` stays
   * null while the model is still answering, which is what draws the
   * placeholder bands.
   */
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [replaceOptions, setReplaceOptions] = useState<ChordAlternative[] | null>(null);
  /** Bumped on every request and on cancel, so a late response is discarded. */
  const replaceRequestRef = useRef(0);

  // Explanation state
  const [isExplanationPopoverOpen, setIsExplanationPopoverOpen] =
    useState(false);
  const [currentExplanationText, setCurrentExplanationText] = useState("");
  const [isExplanationLoading, setIsExplanationLoading] = useState(false);
  const [explanationCache, setExplanationCache] = useState<
    Map<string, string>
  >(new Map());
  const explanationAbortControllerRef = useRef<AbortController | null>(null);
  const currentProgressionKeyRef = useRef<string>("");

  // Edit-with-feedback state
  const [isEditPopoverOpen, setIsEditPopoverOpen] = useState(false);
  const [editFeedback, setEditFeedback] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const { piano, areSamplesLoaded, loadSamples, isLoadingSamples } =
    usePiano();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const playbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heldNotesRef = useRef<string[]>([]);
  const CHORD_PLAYBACK_INTERVAL = 1200;

  // Generate colors based on current chords
  const colors = generateChordColors(
    chords.map((c) => c.chord),
    isDarkMode
  );

  // --- Playback ---

  const singlePlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  /** Notes still sounding from the last single-chord play. */
  const singlePlayNotesRef = useRef<string[]>([]);

  const playChordOnce = useCallback(
    async (chordSymbol: string, chordId?: string) => {
      if (!areSamplesLoaded) {
        if (!isLoadingSamples) await loadSamples();
        return;
      }
      if (!piano) return;
      onChordPlay?.(chordSymbol);

      const notesToPlay = getVoicedChordNotes(chordSymbol);
      if (notesToPlay.length === 0) {
        onActiveNotesChange([]);
        return;
      }

      const noteDuration = 0.8;
      onActiveNotesChange(notesToPlay);

      // The sampler has a 1s release tail, so a chord keeps sounding for well
      // over a second after it is triggered. Releasing the previous copy first
      // makes a repeat retrigger the chord the way a piano key does — without
      // it, identical samples at identical pitches stack and sum in amplitude,
      // so playing one chord repeatedly makes it phase and then clip.
      const startTime = toneNow();
      if (singlePlayNotesRef.current.length > 0) {
        piano.triggerRelease(singlePlayNotesRef.current, startTime);
      }
      // A hair after the release, so the two don't land on the same instant and click.
      piano.triggerAttackRelease(notesToPlay, noteDuration, startTime + 0.01);
      singlePlayNotesRef.current = notesToPlay;

      if (chordId && !isPlaying) {
        if (singlePlayTimeoutRef.current) clearTimeout(singlePlayTimeoutRef.current);
        setPlayingChordId(chordId);
        singlePlayTimeoutRef.current = setTimeout(() => {
          setPlayingChordId((prev) => (prev === chordId ? null : prev));
        }, noteDuration * 1000);
      }

      setTimeout(() => onActiveNotesChange([]), noteDuration * 1000);
    },
    [piano, areSamplesLoaded, isLoadingSamples, loadSamples, onActiveNotesChange, onChordPlay, isPlaying]
  );

  const pauseProgression = useCallback(() => {
    if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
    playbackTimeoutRef.current = null;

    if (piano && heldNotesRef.current.length > 0) {
      piano.triggerRelease(heldNotesRef.current, toneNow());
      heldNotesRef.current = [];
    }

    setIsPlaying(false);
    setPlayingChordId(null);
    onActiveNotesChange([]);
  }, [piano, onActiveNotesChange]);

  const playNextChordRef = useRef<(index: number) => void>(() => {});

  const playNextChord = useCallback(
    (index: number) => {
      if (index >= chords.length) {
        pauseProgression();
        return;
      }

      const chordToPlay = chords[index];
      if (chordToPlay && piano) {
        setPlayingChordId(chordToPlay.id);
        const newNotes = getVoicedChordNotes(chordToPlay.chord);

        if (newNotes.length > 0) {
          if (heldNotesRef.current.length > 0) {
            piano.triggerRelease(heldNotesRef.current, toneNow());
          }
          piano.triggerAttack(newNotes, toneNow());
          heldNotesRef.current = newNotes;
          onActiveNotesChange(newNotes);
        }

        playbackTimeoutRef.current = setTimeout(() => {
          playNextChordRef.current(index + 1);
        }, CHORD_PLAYBACK_INTERVAL);
      } else {
        pauseProgression();
      }
    },
    [chords, piano, pauseProgression, onActiveNotesChange]
  );
  useEffect(() => {
    playNextChordRef.current = playNextChord;
  }, [playNextChord]);

  const handleTogglePlayPause = useCallback(async () => {
    if (isPlaying) {
      pauseProgression();
    } else {
      if (chords.length === 0) return;
      if (!areSamplesLoaded) {
        if (!isLoadingSamples) await loadSamples();
        return;
      }
      setIsPlaying(true);
      playNextChord(0);
    }
  }, [
    isPlaying,
    pauseProgression,
    playNextChord,
    chords,
    areSamplesLoaded,
    isLoadingSamples,
    loadSamples,
  ]);

  // Stop playback when chords change (syncs Tone.js playback to the chords prop)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    pauseProgression();
  }, [chords, pauseProgression]);

  // --- Drag & Drop ---

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setChords((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  }, [setChords]);

  // --- Add / Remove ---

  /**
   * Closes the replace panel and invalidates any request still in flight, so a
   * slow answer can't reopen a panel the user already dismissed.
   */
  const cancelReplace = useCallback(() => {
    replaceRequestRef.current += 1;
    setReplaceTargetId(null);
    setReplaceOptions(null);
  }, []);

  const handleRemoveChord = useCallback((chordId: string) => {
    if (chordId === replaceTargetId) cancelReplace();
    setChords((prev) => prev.filter((c) => c.id !== chordId));
  }, [setChords, replaceTargetId, cancelReplace]);

  /**
   * Session history plus this card's own edit trail: each edit iteration
   * becomes a round of its own ("after the user said X, you produced these
   * chords"), so an inserted chord sees the same cumulative feedback the
   * progression around it was generated from. Iterations *after* the one on
   * screen are left out — their notes don't apply to what the user is looking
   * at.
   */
  const requestRounds = useMemo<GenerationRound[]>(() => {
    const editRounds = iterations
      .slice(1, currentIteration + 1)
      .map((chordItems, i) => ({
        feedback: iterationFeedback[i + 1],
        progressions: [
          { chords: chordItems.map((c) => c.chord).filter(Boolean), style },
        ],
      }))
      .filter((round) => round.progressions[0].chords.length > 0);

    return [...(history ?? []), ...editRounds];
  }, [history, iterations, iterationFeedback, currentIteration, style]);

  const addChordAt = useCallback(
    async (position: number) => {
      if (chords.length >= 8) return;

      const newChordId = generateUniqueId();
      const placeholderChord: ChordItem = { id: newChordId, chord: "" };

      const originalChords = [...chords];
      const updatedChordsWithPlaceholder = [
        ...originalChords.slice(0, position),
        placeholderChord,
        ...originalChords.slice(position),
      ];
      setChords(updatedChordsWithPlaceholder);
      setLoadingChordId(newChordId);

      try {
        const existingChordsForApi = originalChords.map((c) => ({
          chord: c.chord,
        }));

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            existingChords: existingChordsForApi,
            addChordPosition: position,
            prompt: prompt || "add one suitable chord here",
            rounds: requestRounds,
          }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          setChords(originalChords);
          setLoadingChordId(null);
          return;
        }

        const cleanedReceivedChordSymbol = data.chord?.trim();
        const chordData = cleanedReceivedChordSymbol
          ? Chord.get(cleanedReceivedChordSymbol)
          : null;

        if (
          !cleanedReceivedChordSymbol ||
          !chordData ||
          !chordData.symbol
        ) {
          setChords(originalChords);
          setLoadingChordId(null);
          return;
        }

        const updatedChordItem: ChordItem = {
          id: newChordId,
          chord: chordData.symbol,
        };
        setChords((prev) =>
          prev.map((ch) => (ch.id === newChordId ? updatedChordItem : ch))
        );
      } catch (e) {
        console.error("Error adding chord:", e);
        setChords(originalChords);
      }
      setLoadingChordId(null);
    },
    [chords, prompt, requestRounds, setChords]
  );

  // --- Replace a chord ---

  const handleRequestReplace = useCallback(
    async (chordId: string) => {
      const index = chords.findIndex((c) => c.id === chordId);
      if (index === -1 || !chords[index].chord) return;

      const requestId = replaceRequestRef.current + 1;
      replaceRequestRef.current = requestId;
      setReplaceTargetId(chordId);
      setReplaceOptions(null);

      try {
        const res = await fetch("/api/replace-chord", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chords: chords.map((c) => c.chord),
            index,
            prompt,
            rounds: requestRounds,
          }),
        });

        const data = await res.json();
        // The user cancelled, or asked about a different chord, while we waited.
        if (replaceRequestRef.current !== requestId) return;

        if (!res.ok || data.error || !Array.isArray(data.alternatives)) {
          console.error("Replace chord API error:", data.error);
          setReplaceTargetId(null);
          return;
        }

        setReplaceOptions(
          data.alternatives
            .filter((a: ChordAlternative) => a && typeof a.chord === "string")
            .slice(0, 3)
        );
      } catch (e) {
        console.error("Error fetching chord alternatives:", e);
        if (replaceRequestRef.current === requestId) setReplaceTargetId(null);
      }
    },
    [chords, prompt, requestRounds]
  );

  const handleChooseAlternative = useCallback(
    (chordId: string, chord: string) => {
      cancelReplace();
      setChords((prev) =>
        prev.map((c) => (c.id === chordId ? { ...c, chord } : c))
      );
    },
    [cancelReplace, setChords]
  );

  // --- Explanation ---

  const fetchAndStreamExplanation = async (progressionKey: string) => {
    if (explanationAbortControllerRef.current) {
      explanationAbortControllerRef.current.abort();
    }
    explanationAbortControllerRef.current = new AbortController();
    setIsExplanationLoading(true);
    let accumulatedText = "";
    setCurrentExplanationText("");

    try {
      const response = await fetch("/api/explain-progression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chords: chords.map((c) => c.chord),
          prompt,
        }),
        signal: explanationAbortControllerRef.current.signal,
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      if (!response.body) throw new Error("Response body is null");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) break;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;
          if (currentProgressionKeyRef.current === progressionKey) {
            setCurrentExplanationText((prev) => prev + chunk);
          }
        }
      }

      if (currentProgressionKeyRef.current === progressionKey) {
        setExplanationCache(
          (prev) => new Map(prev).set(progressionKey, accumulatedText)
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // Aborted
      } else {
        if (currentProgressionKeyRef.current === progressionKey) {
          setCurrentExplanationText("Error fetching explanation.");
        }
      }
    } finally {
      if (currentProgressionKeyRef.current === progressionKey) {
        setIsExplanationLoading(false);
      }
      explanationAbortControllerRef.current = null;
    }
  };

  const handleExplainClick = () => {
    if (chords.length === 0) return;
    const progressionKey = chords.map((c) => c.chord).join("-");

    if (
      isExplanationPopoverOpen &&
      currentProgressionKeyRef.current === progressionKey &&
      !isExplanationLoading
    ) {
      setIsExplanationPopoverOpen(false);
      return;
    }

    currentProgressionKeyRef.current = progressionKey;
    setIsExplanationPopoverOpen(true);

    if (explanationCache.has(progressionKey)) {
      setCurrentExplanationText(
        explanationCache.get(progressionKey) || ""
      );
      setIsExplanationLoading(false);
    } else {
      setCurrentExplanationText("");
      fetchAndStreamExplanation(progressionKey);
    }
  };

  const onPopoverOpenChange = (open: boolean) => {
    setIsExplanationPopoverOpen(open);
    if (!open && explanationAbortControllerRef.current) {
      explanationAbortControllerRef.current.abort();
    }
  };

  // --- Edit with feedback (creates a new iteration) ---

  const handleSendFeedback = useCallback(async () => {
    const feedbackText = editFeedback.trim();
    if (!feedbackText || isEditSubmitting || chords.length === 0) return;

    const chordsForApi = chords.map((c) => c.chord);
    const newIterationIndex = iterations.length;

    cancelReplace();
    setIsEditSubmitting(true);
    setEditFeedback("");
    setIsEditPopoverOpen(false);
    setIterations((prev) => [...prev, []]);
    setIterationFeedback((prev) => [...prev, feedbackText]);
    setLoadingIterationIndex(newIterationIndex);
    setCurrentIteration(newIterationIndex);

    try {
      const res = await fetch("/api/edit-progression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chords: chordsForApi,
          feedback: feedbackText,
          prompt,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error || !Array.isArray(data.chords)) {
        console.error("Edit progression API error:", data.error);
        setIterations((prev) => prev.slice(0, newIterationIndex));
        setIterationFeedback((prev) => prev.slice(0, newIterationIndex));
        setCurrentIteration(newIterationIndex - 1);
        return;
      }

      const newChordItems: ChordItem[] = data.chords.map(
        (chord: string, index: number) => ({
          id: `${id}-iter-${newIterationIndex}-chord-${index}-${generateUniqueId()}`,
          chord,
        })
      );

      setIterations((prev) => {
        const copy = [...prev];
        copy[newIterationIndex] = newChordItems;
        return copy;
      });
    } catch (e) {
      console.error("Error editing progression:", e);
      setIterations((prev) => prev.slice(0, newIterationIndex));
      setIterationFeedback((prev) => prev.slice(0, newIterationIndex));
      setCurrentIteration(newIterationIndex - 1);
    } finally {
      setLoadingIterationIndex(null);
      setIsEditSubmitting(false);
    }
  }, [editFeedback, isEditSubmitting, chords, iterations.length, prompt, id, cancelReplace]);

  const onEditPopoverOpenChange = useCallback((open: boolean) => {
    setIsEditPopoverOpen(open);
  }, []);

  // A different iteration is a different progression, so any open replace
  // panel belongs to what was on screen a moment ago, not to what's there now.
  const goToPreviousIteration = useCallback(() => {
    cancelReplace();
    setCurrentIteration((i) => Math.max(0, i - 1));
  }, [cancelReplace]);

  const goToNextIteration = useCallback(() => {
    cancelReplace();
    setCurrentIteration((i) => Math.min(iterations.length - 1, i + 1));
  }, [iterations.length, cancelReplace]);

  const hasChords = chords.length > 0;
  const isCurrentIterationLoading = loadingIterationIndex === currentIteration;

  return (
    <div className="w-full rounded-3xl overflow-hidden border border-border/50 bg-card/50">
      <ColumnToolbar
        style={style}
        chords={chords.map((c) => c.chord)}
        prompt={prompt}
        isPlaying={isPlaying}
        onTogglePlayPause={handleTogglePlayPause}
        isExplanationPopoverOpen={isExplanationPopoverOpen}
        onExplainClick={handleExplainClick}
        onPopoverOpenChange={onPopoverOpenChange}
        isExplanationLoading={isExplanationLoading}
        currentExplanationText={currentExplanationText}
        isSaved={isSaved ? isSaved(saveId) : false}
        onToggleSave={onToggleSave ? () => onToggleSave(saveId, chords.map((c) => c.chord)) : undefined}
        isSignedIn={isSignedIn}
        iterationIndex={currentIteration}
        iterationCount={iterations.length}
        onPrevIteration={goToPreviousIteration}
        onNextIteration={goToNextIteration}
        isEditPopoverOpen={isEditPopoverOpen}
        onEditPopoverOpenChange={onEditPopoverOpenChange}
        editFeedback={editFeedback}
        onEditFeedbackChange={setEditFeedback}
        onSendFeedback={handleSendFeedback}
        isEditSubmitting={isEditSubmitting}
      />

      {/* Skeleton and strip are stacked and cross-faded rather than swapped, so
          sending an edit dissolves into the placeholder and back out again.
          Keying on the iteration means stepping between versions dissolves too,
          instead of collapsing every column to nothing and regrowing it. */}
      {(isCurrentIterationLoading || hasChords) && (
        <div className="relative" style={{ height: "50vh", minHeight: 300 }}>
          <AnimatePresence initial={false}>
            {isCurrentIterationLoading ? (
              <motion.div
                key="loading"
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <ColumnsSkeleton
                  count={chords.length || 4}
                  style={{ height: "100%", minHeight: 0 }}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`iteration-${currentIteration}`}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={chords.map((c) => c.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    <div className="flex h-full w-full overflow-x-auto md:overflow-x-hidden snap-x snap-mandatory md:snap-none">
                      <AnimatePresence mode="popLayout">
                        {chords.flatMap((chord, index) => [
                          <ColumnSpacer
                            key={`spacer-${index}`}
                            position={index}
                            chordsCount={chords.length}
                            addChordAt={addChordAt}
                          />,
                          <ChordColumn
                            key={chord.id}
                            id={chord.id}
                            chord={chord.chord}
                            color={
                              colors[index] || {
                                bg: "hsl(220, 60%, 70%)",
                                text: "white",
                                hue: 220,
                                saturation: 60,
                                lightness: 70,
                              }
                            }
                            playingId={playingChordId}
                            loading={loadingChordId === chord.id}
                            isDarkMode={isDarkMode}
                            isReplacing={replaceTargetId === chord.id}
                            alternatives={
                              replaceTargetId === chord.id ? replaceOptions : null
                            }
                            onPlay={playChordOnce}
                            onRemove={() => handleRemoveChord(chord.id)}
                            onRequestReplace={() => handleRequestReplace(chord.id)}
                            onCancelReplace={cancelReplace}
                            onChooseAlternative={(alt) =>
                              handleChooseAlternative(chord.id, alt)
                            }
                          />,
                        ])}
                        <ColumnSpacer
                          key="spacer-trailing"
                          position={chords.length}
                          chordsCount={chords.length}
                          addChordAt={addChordAt}
                        />
                      </AnimatePresence>
                    </div>
                  </SortableContext>
                </DndContext>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
