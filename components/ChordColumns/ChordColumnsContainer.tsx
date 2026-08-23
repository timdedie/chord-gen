"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
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
import { ColumnsSkeleton } from "./ProgressionSkeleton";
import { Chord } from "tonal";
import { now as toneNow } from "tone";
import { usePiano } from "@/components/PianoProvider";
import { getVoicedChordNotes } from "@/lib/chordUtils";
import { generateChordColors } from "@/lib/chordColors";
import { useTheme } from "next-themes";
import ChordColumn from "./ChordColumn";
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
      piano.triggerAttackRelease(notesToPlay, noteDuration, toneNow());

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

  const handleRemoveChord = useCallback((chordId: string) => {
    setChords((prev) => prev.filter((c) => c.id !== chordId));
  }, [setChords]);

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
    [chords, prompt, setChords]
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

    setIsEditSubmitting(true);
    setEditFeedback("");
    setIsEditPopoverOpen(false);
    setIterations((prev) => [...prev, []]);
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
      setCurrentIteration(newIterationIndex - 1);
    } finally {
      setLoadingIterationIndex(null);
      setIsEditSubmitting(false);
    }
  }, [editFeedback, isEditSubmitting, chords, iterations.length, prompt, id]);

  const onEditPopoverOpenChange = useCallback((open: boolean) => {
    setIsEditPopoverOpen(open);
  }, []);

  const goToPreviousIteration = useCallback(() => {
    setCurrentIteration((i) => Math.max(0, i - 1));
  }, []);

  const goToNextIteration = useCallback(() => {
    setCurrentIteration((i) => Math.min(iterations.length - 1, i + 1));
  }, [iterations.length]);

  const hasChords = chords.length > 0;
  const isCurrentIterationLoading = loadingIterationIndex === currentIteration;

  return (
    <div className="w-full rounded-xl overflow-hidden border border-border/50 bg-card/50">
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

      {isCurrentIterationLoading ? (
        <ColumnsSkeleton count={chords.length || 4} />
      ) : hasChords && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={chords.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div
              className="flex w-full overflow-x-auto md:overflow-x-hidden snap-x snap-mandatory md:snap-none"
              style={{ height: "50vh", minHeight: 300 }}
            >
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
                    isPlaying={playingChordId === chord.id}
                    loading={loadingChordId === chord.id}
                    onPlay={() => playChordOnce(chord.chord, chord.id)}
                    onRemove={() => handleRemoveChord(chord.id)}
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
      )}
    </div>
  );
}
