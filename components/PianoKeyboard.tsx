"use client";

import React, { useState, useEffect } from "react";
import { Piano, MidiNumbers } from "react-piano";
import "react-piano/dist/styles.css";
import { usePiano } from "./PianoProvider";

interface PianoKeyboardProps {
    firstNote: number;
    lastNote: number;
    activeNotes: string[];
    width?: number;
}

export default function PianoKeyboard({
                                          firstNote,
                                          lastNote,
                                          activeNotes,
                                          width = 400,
                                      }: PianoKeyboardProps) {
    const { piano, areSamplesLoaded, loadSamples, resumeAudio } = usePiano();
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reads matchMedia, unavailable during SSR
        setIsMobile(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    const responsiveWidth = isMobile ? Math.min(window.innerWidth * 0.7, 180) : width;

    const handlePlayNote = (midiNumber: number) => {
        // Pressing a key is a user gesture — the one moment a browser will let
        // the audio context start. react-piano calls this synchronously, so
        // this is fire-and-forget: if the context was still suspended, this
        // press is silent and the next one sounds.
        void resumeAudio();

        if (!piano || !areSamplesLoaded) {
            void loadSamples({ retry: true });
            return;
        }
        const note = MidiNumbers.getAttributes(midiNumber).note;
        piano.triggerAttack(note);
    };

    const handleStopNote = (midiNumber: number) => {
        if (piano && areSamplesLoaded) { // Check if piano instance exists and samples are loaded
            const note = MidiNumbers.getAttributes(midiNumber).note;
            piano.triggerRelease(note);
        }
    };

    const sanitizedActiveNotes = activeNotes
        .map(n => n.trim())
        .filter(n => /^[A-G](?:#|b)?\d$/.test(n))
        .map(n => {
            try {
                return MidiNumbers.fromNote(n);
            } catch {
                console.warn(`⚠️ Invalid note dropped: "${n}"`);
                return null;
            }
        })
        .filter((midi): midi is number => midi !== null);

    return (
        <div className={`fixed bottom-0 left-0 right-0 flex justify-center z-30 transition-[left] duration-200 md:left-[var(--sidebar-w,3.5rem)] ${isMobile ? 'p-2' : 'p-4'}`}>
            <div className={`w-full ${isMobile ? 'max-w-[180px]' : 'max-w-[400px]'} bg-transparent`}>
                <div className="bg-transparent drop-shadow-lg">
                    <Piano
                        noteRange={{ first: firstNote, last: lastNote }}
                        playNote={handlePlayNote}
                        stopNote={handleStopNote}
                        activeNotes={sanitizedActiveNotes}
                        width={responsiveWidth}
                        renderNoteLabel={() => null}
                    />
                </div>
            </div>
        </div>
    );
}