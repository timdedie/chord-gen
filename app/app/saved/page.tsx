"use client";

import React, { useState, useCallback, useEffect } from "react";
import { MidiNumbers } from "react-piano";
import dynamic from "next/dynamic";
import { Heart } from "lucide-react";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { useSavedProgressions } from "@/hooks/useSavedProgressions";
import { usePiano } from "@/components/PianoProvider";

const PianoKeyboard = dynamic(() => import("@/components/PianoKeyboard"), { ssr: false });
const ChordColumnsContainer = dynamic(
    () => import("@/components/ChordColumns/ChordColumnsContainer"),
    { ssr: false }
);

export default function SavedPage() {
    const { saved, isSaved, toggleSave, isLoading, isSignedIn } = useSavedProgressions();
    const { loadSamples } = usePiano();
    const [activeNotes, setActiveNotes] = useState<string[]>([]);

    // Fetching the samples needs no user gesture; resuming the AudioContext
    // does, and that happens in the click handler that plays a chord.
    useEffect(() => {
        loadSamples();
    }, [loadSamples]);

    const handleActiveNotesChange = useCallback((notes: string[]) => {
        setActiveNotes(notes);
    }, []);

    const firstNote = MidiNumbers.fromNote("C3");
    const lastNote = MidiNumbers.fromNote("C5");

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
            <div className="fixed top-0 left-0 right-0 h-12 bg-gradient-to-b from-gray-50 dark:from-black to-transparent pointer-events-none z-20 transition-[left] duration-200 md:left-[var(--sidebar-w,3.5rem)]" />

            <main className="container max-w-6xl mx-auto px-4 pt-16 pb-48">
                <div className="flex items-center gap-3 mb-8">
                    <Heart className="h-5 w-5 text-red-500 fill-current" />
                    <h1 className="text-2xl font-bold">Saved Progressions</h1>
                </div>

                {!isSignedIn ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
                        <Heart className="h-12 w-12 text-muted-foreground/30" />
                        <p className="text-muted-foreground text-lg">Sign in to save chord progressions</p>
                        <SignInButton mode="modal">
                            <Button>Sign in</Button>
                        </SignInButton>
                    </div>
                ) : isLoading ? (
                    <div className="flex justify-center py-24">
                        <Heart className="h-8 w-8 text-muted-foreground/30 animate-pulse" />
                    </div>
                ) : saved.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <Heart className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground text-lg">No saved progressions yet.</p>
                        <p className="text-muted-foreground text-sm mt-2">
                            Click the heart icon on any progression to save it here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {[...saved].reverse().map((progression) => (
                            <div key={progression.id}>
                                {progression.prompt && (
                                    <p className="text-xs text-muted-foreground mb-2 px-1">
                                        Prompt: <span className="italic">{progression.prompt}</span>
                                    </p>
                                )}
                                <ChordColumnsContainer
                                    id={progression.id}
                                    initialChords={progression.chords}
                                    style={progression.style}
                                    prompt={progression.prompt}
                                    onActiveNotesChange={handleActiveNotesChange}
                                    isSaved={isSaved}
                                    onToggleSave={(saveId, chords) =>
                                        toggleSave({ id: saveId, chords, style: progression.style, prompt: progression.prompt })
                                    }
                                    isSignedIn={isSignedIn}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-50 dark:from-black to-transparent pointer-events-none z-20 transition-[left] duration-200 md:left-[var(--sidebar-w,3.5rem)]" />
            <PianoKeyboard firstNote={firstNote} lastNote={lastNote} activeNotes={activeNotes} />
        </div>
    );
}
