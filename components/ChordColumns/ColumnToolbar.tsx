"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Play,
  Pause,
  Download,
  Sparkles,
  Heart,
  Pencil,
  Send,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SignInButton } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { capture, AnalyticsEvent } from "@/lib/analytics/events";

const MidiDownloaderInline = dynamic(
  () => import("@/components/MidiDownloader"),
  {
    loading: () => (
      <Button size="sm" variant="ghost" disabled>
        <Download className="h-4 w-4 mr-1" />
        MIDI
      </Button>
    ),
    ssr: false,
  }
);

const DynamicMarkdownDisplay = dynamic(
  () => import("@/components/MarkdownDisplay"),
  {
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Sparkles className="h-6 w-6 animate-pulse text-primary" />
      </div>
    ),
    ssr: false,
  }
);

interface ColumnToolbarProps {
  style: string;
  chords: string[];
  prompt: string;
  isPlaying: boolean;
  onTogglePlayPause: () => void;
  isExplanationPopoverOpen: boolean;
  onExplainClick: () => void;
  onPopoverOpenChange: (open: boolean) => void;
  isExplanationLoading: boolean;
  currentExplanationText: string;
  isSaved?: boolean;
  onToggleSave?: () => void;
  isSignedIn?: boolean;
  iterationIndex: number;
  iterationCount: number;
  onPrevIteration: () => void;
  onNextIteration: () => void;
  isEditPopoverOpen: boolean;
  onEditPopoverOpenChange: (open: boolean) => void;
  editFeedback: string;
  onEditFeedbackChange: (value: string) => void;
  onSendFeedback: () => void;
  isEditSubmitting: boolean;
}

export default function ColumnToolbar({
  style,
  chords,
  prompt,
  isPlaying,
  onTogglePlayPause,
  isExplanationPopoverOpen,
  onExplainClick,
  onPopoverOpenChange,
  isExplanationLoading,
  currentExplanationText,
  isSaved = false,
  onToggleSave,
  isSignedIn = false,
  iterationIndex,
  iterationCount,
  onPrevIteration,
  onNextIteration,
  isEditPopoverOpen,
  onEditPopoverOpenChange,
  editFeedback,
  onEditFeedbackChange,
  onSendFeedback,
  isEditSubmitting,
}: ColumnToolbarProps) {
  const handleSendFeedback = () => {
    capture(AnalyticsEvent.ProgressionEdited, {
      style,
      chord_count: chords.length,
      feedback_length: editFeedback.length,
    });
    onSendFeedback();
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-sm border-b border-border/50">
      <div className="flex items-center gap-3">
        <Button
          onClick={() => {
            // Only count starts, not pauses, as a "play".
            if (!isPlaying) {
              capture(AnalyticsEvent.ProgressionPlayed, {
                style,
                chord_count: chords.length,
              });
            }
            onTogglePlayPause();
          }}
          variant="ghost"
          size="icon"
          className="relative w-9 h-9 rounded-full"
        >
          <AnimatePresence mode="wait" initial={false}>
            {isPlaying ? (
              <motion.div
                key="pause"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Pause className="h-4 w-4" />
              </motion.div>
            ) : (
              <motion.div
                key="play"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Play className="h-4 w-4" fill="currentColor" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
        <h3 className="text-sm font-medium text-foreground">{style}</h3>
      </div>

      <div className="flex items-center gap-1.5">
        {iterationCount > 1 && (
          <div className="flex items-center gap-0.5 mr-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onPrevIteration}
              disabled={iterationIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums px-0.5 min-w-[2.5rem] text-center">
              {iterationIndex + 1} / {iterationCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onNextIteration}
              disabled={iterationIndex === iterationCount - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        <Popover open={isEditPopoverOpen} onOpenChange={onEditPopoverOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isEditSubmitting || chords.length === 0}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] sm:w-[360px] p-3" sideOffset={5}>
            <h4 className="font-medium leading-none text-sm mb-2">
              Describe your changes
            </h4>
            <Textarea
              value={editFeedback}
              onChange={(e) => onEditFeedbackChange(e.target.value)}
              placeholder="e.g. make the third chord more tense, swap the last chord for something darker…"
              className="min-h-[70px] text-sm resize-none"
              maxLength={300}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (editFeedback.trim() && !isEditSubmitting) {
                    handleSendFeedback();
                  }
                }
              }}
            />
            <div className="text-right text-xs text-muted-foreground mt-1">
              {editFeedback.length}/300
            </div>
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                onClick={handleSendFeedback}
                disabled={!editFeedback.trim() || isEditSubmitting}
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                Send
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Popover
          open={isExplanationPopoverOpen}
          onOpenChange={onPopoverOpenChange}
        >
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                capture(AnalyticsEvent.ProgressionExplained, {
                  style,
                  chord_count: chords.length,
                });
                onExplainClick();
              }}
              disabled={isExplanationLoading}
            >
              {isExplanationLoading ? (
                <Sparkles className="h-4 w-4 mr-1 animate-pulse" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Explain
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[300px] sm:w-[380px] p-4"
            sideOffset={5}
          >
            <h4 className="font-medium leading-none text-sm mb-2">
              Explanation
            </h4>
            <div className="min-h-[50px] w-full">
              {isExplanationLoading && !currentExplanationText && (
                <div className="flex items-center justify-center h-full">
                  <Sparkles className="h-6 w-6 animate-pulse text-primary" />
                </div>
              )}
              {currentExplanationText && (
                <DynamicMarkdownDisplay
                  markdownText={currentExplanationText}
                />
              )}
            </div>
          </PopoverContent>
        </Popover>

        <MidiDownloaderInline chords={chords} prompt={prompt} compact variant="ghost" />
        {onToggleSave && (
          isSignedIn ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleSave}
              className={isSaved ? "text-red-500 hover:text-red-600" : ""}
            >
              <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
            </Button>
          ) : (
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                <Heart className="h-4 w-4" />
              </Button>
            </SignInButton>
          )
        )}
      </div>
    </div>
  );
}
