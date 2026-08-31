"use client";

import React, {
    createContext,
    useState,
    useCallback,
    useContext,
    useRef,
    ReactNode,
} from "react";
import { Sampler, getContext, start as toneStart } from "tone";

const SAMPLE_URLS = {
    A2: "A2.mp3", A3: "A3.mp3", A4: "A4.mp3", A5: "A5.mp3",
    C2: "C2.mp3", C3: "C3.mp3", C4: "C4.mp3", C5: "C5.mp3", C6: "C6.mp3",
    "D#2": "Dsharp2.mp3", "D#3": "Dsharp3.mp3", "D#4": "Dsharp4.mp3", "D#5": "Dsharp5.mp3",
    "F#2": "Fsharp2.mp3", "F#3": "Fsharp3.mp3", "F#4": "Fsharp4.mp3", "F#5": "Fsharp5.mp3",
};

const SAMPLE_LOAD_TIMEOUT_MS = 15000;

export interface PianoContextState {
    piano: Sampler | null;
    /**
     * Fetch and decode the piano samples, resolving to the sampler.
     *
     * Safe to call from an effect: it never touches the AudioContext's run
     * state, so it does not need a user gesture. A failed load is not retried
     * automatically — the mount effects would re-fire on every render and
     * hammer a failing network — but `{ retry: true }` from a user action asks
     * for one more go.
     */
    loadSamples: (options?: { retry?: boolean }) => Promise<Sampler | null>;
    /**
     * Resume the AudioContext. Must be called from inside a user gesture, and
     * is a no-op once the context is running.
     */
    resumeAudio: () => Promise<void>;
    areSamplesLoaded: boolean;
    isLoadingSamples: boolean;
}

export const PianoContext = createContext<PianoContextState | null>(null);

interface PianoProviderProps {
    children: ReactNode;
}

export default function PianoProvider({ children }: PianoProviderProps) {
    const [pianoInstance, setPianoInstance] = useState<Sampler | null>(null);
    const [areSamplesLoaded, setAreSamplesLoaded] = useState<boolean>(false);
    const [isLoadingSamples, setIsLoadingSamples] = useState<boolean>(false);

    // Load bookkeeping lives in refs rather than state. Two callers in the same
    // tick both read the same stale `isLoadingSamples` and would each kick off
    // a load; a ref is written the moment the first one starts.
    const samplerRef = useRef<Sampler | null>(null);
    const loadPromiseRef = useRef<Promise<Sampler | null> | null>(null);
    const loadFailedRef = useRef(false);

    const loadSamples = useCallback(
        async (options?: { retry?: boolean }): Promise<Sampler | null> => {
            if (samplerRef.current) return samplerRef.current;
            if (loadPromiseRef.current) return loadPromiseRef.current;
            if (loadFailedRef.current && !options?.retry) return null;

            loadFailedRef.current = false;
            setIsLoadingSamples(true);

            const load = (async (): Promise<Sampler | null> => {
                try {
                    // Buffers fetch and decode happily on a suspended context,
                    // so the samples are loaded here and the context is resumed
                    // separately by `resumeAudio` from a click. Awaiting the
                    // resume here instead would wedge the whole provider: on a
                    // page with no user gesture yet the promise never settles.
                    const samplerPromise = new Promise<Sampler>((resolve, reject) => {
                        const sampler = new Sampler({
                            urls: SAMPLE_URLS,
                            release: 1,
                            baseUrl: "/piano/",
                            onload: () => resolve(sampler),
                            onerror: reject,
                        }).toDestination();
                    });

                    let timeoutId: ReturnType<typeof setTimeout> | undefined;
                    const timeoutPromise = new Promise<never>((_, reject) => {
                        timeoutId = setTimeout(
                            () => reject(new Error("Timeout: Piano samples took too long to load (15s).")),
                            SAMPLE_LOAD_TIMEOUT_MS
                        );
                    });

                    try {
                        const sampler = await Promise.race([samplerPromise, timeoutPromise]);
                        samplerRef.current = sampler;
                        setPianoInstance(sampler);
                        setAreSamplesLoaded(true);
                        return sampler;
                    } finally {
                        clearTimeout(timeoutId);
                    }
                } catch (error) {
                    console.error("Error loading piano samples:", error);
                    loadFailedRef.current = true;
                    return null;
                } finally {
                    loadPromiseRef.current = null;
                    setIsLoadingSamples(false);
                }
            })();

            loadPromiseRef.current = load;
            return load;
        },
        []
    );

    const resumeAudio = useCallback(async () => {
        // Browsers only let an AudioContext leave "suspended" inside a user
        // gesture, and a blocked resume never settles — so every sound-making
        // path calls this from its own click handler.
        if (getContext().state === "running") return;
        try {
            await toneStart();
        } catch (error) {
            console.error("Could not start the audio context:", error);
        }
    }, []);

    return (
        <PianoContext.Provider
            value={{
                piano: pianoInstance,
                loadSamples,
                resumeAudio,
                areSamplesLoaded,
                isLoadingSamples,
            }}
        >
            {children}
        </PianoContext.Provider>
    );
}

export const usePiano = (): PianoContextState => {
    const context = useContext(PianoContext);
    if (context === null) {
        throw new Error("usePiano must be used within a PianoProvider. Make sure ClientHome is wrapped by PianoProvider in app/page.tsx.");
    }
    return context;
};
