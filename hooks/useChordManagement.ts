import { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useState, useCallback, useRef, useEffect } from "react";
import { Chord } from "tonal";
import { toast } from "sonner";

export interface ChordItem {
    id: string;
    chord: string;
}

const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

interface UseChordManagementProps {
    initialPrompt?: string;
    initialChords?: ChordItem[];
}

interface GenerationParams {
    numChords: number;
    customPrompt?: string;
}

// Added: Define types for the expected API response
interface ApiChordProgressionResponse {
    chords: string[];
    error?: string;
    details?: any; // To capture potential error details from API
}

export function useChordManagement(props?: UseChordManagementProps) {
    const [prompt, setPrompt] = useState<string>(props?.initialPrompt || "");
    const [chords, setChords] = useState<ChordItem[]>(props?.initialChords || []);
    const [fullLoading, setFullLoading] = useState<boolean>(false);

    const showErrorToast = useCallback((title: string, description?: string) => {
        toast.error(title, {
            description: description,
        });
    }, []);

    type GenerateChordsInternal = (
        currentPromptInternal: string,
        currentChords: ChordItem[],
        numChordsToGen: number,
        attempt?: number
    ) => Promise<ChordItem[] | null>;

    const generateChordsInternalRef = useRef<GenerateChordsInternal>(async () => null);

    const generateChordsInternal = useCallback<GenerateChordsInternal>(
        async (
            currentPromptInternal: string,
            currentChords: ChordItem[],
            numChordsToGen: number,
            attempt: number = 0
        ): Promise<ChordItem[] | null> => {
            const MAX_ATTEMPTS = 3;
            setFullLoading(true);
            let generatedChordsResult = null;

            try {
                const existingChordsForApi = currentChords.map(c => ({ chord: c.chord }));

                const res = await fetch("/api/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: currentPromptInternal,
                        existingChords: existingChordsForApi,
                        numChords: numChordsToGen,
                    }),
                });

                const data: ApiChordProgressionResponse = await res.json();

                if (!res.ok || data.error) {
                    const errorMsg = data.error || "Failed to generate chords from server.";
                    let errorDetails = "";
                    if (data.details) {
                        // Attempt to stringify details if they are an object, otherwise use as is
                        errorDetails = typeof data.details === 'object' ? JSON.stringify(data.details) : String(data.details);
                    }
                    console.error("Generation API Error:", errorMsg, data.details);
                    showErrorToast("Generation Failed", `${errorMsg}${errorDetails ? ` Details: ${errorDetails}` : ''}`);
                    setFullLoading(false);
                    return null;
                }

                const receivedChordSymbols = data.chords;

                if (!Array.isArray(receivedChordSymbols)) {
                    showErrorToast("Generation Error", "AI returned an unexpected data format.");
                    setFullLoading(false); return null;
                }

                // Data from API is already transformed by Zod, so direct trim is sufficient here.
                // The .replace(/△/g, "") is removed as Tonal handles △ correctly.
                const cleanedChordSymbols = receivedChordSymbols
                    .map((c: string) => c.trim()) // API should provide cleaned strings via Zod
                    .filter((c: string) => c);


                let allCleanedChordsAreValid = true;
                if (cleanedChordSymbols.length === 0 && numChordsToGen > 0) {
                    allCleanedChordsAreValid = false;
                } else {
                    for (const chordName of cleanedChordSymbols) {
                        const chordData = Chord.get(chordName);
                        // Updated validation: ensure symbol, name, and notes are present
                        if (!chordData || !chordData.symbol || !chordData.name || !chordData.notes || chordData.notes.length === 0) {
                            allCleanedChordsAreValid = false;
                            break;
                        }
                    }
                }


                if (!allCleanedChordsAreValid) {
                    if (attempt < MAX_ATTEMPTS - 1) {
                        console.warn(`Invalid chord name(s) or empty array found in AI response ("${cleanedChordSymbols.join('-')}"), reattempting generation`, attempt + 1);
                        return generateChordsInternalRef.current(currentPromptInternal, currentChords, numChordsToGen, attempt + 1);
                    } else {
                        showErrorToast("Generation Error", `AI returned invalid chord names ("${cleanedChordSymbols.join(', ')}") or an empty array after several attempts.`);
                        setFullLoading(false); return null;
                    }
                }

                if (cleanedChordSymbols.length !== numChordsToGen && currentChords.length === 0) {
                    console.warn(`AI returned ${cleanedChordSymbols.length} chords for initial generation, but expected ${numChordsToGen}. Proceeding with AI's response.`);
                } else if (cleanedChordSymbols.length !== numChordsToGen && currentChords.length > 0) {
                    console.warn(`AI returned ${cleanedChordSymbols.length} chords for regeneration, but expected ${numChordsToGen}. Proceeding with AI's response.`);
                }


                generatedChordsResult = cleanedChordSymbols.map((cleanedAiChordName: string, index: number) => {
                    const originalChordInSlot = (currentChords.length === cleanedChordSymbols.length) ? currentChords[index] : undefined;
                    // Use tonal's canonical symbol. Validation loop ensures chordData.symbol is non-null.
                    const chordSymbol = Chord.get(cleanedAiChordName).symbol;
                    return {
                        id: originalChordInSlot?.id || generateUniqueId(),
                        chord: chordSymbol!,
                    };
                });

            } catch (e: any) {
                console.error("Generation error (catch block):", e);
                showErrorToast("Network Error", e.message || "Error generating chords. Please try again.");
                setFullLoading(false);
                return null;
            }
            setFullLoading(false);
            return generatedChordsResult;
        },
        [showErrorToast]
    );
    useEffect(() => {
        generateChordsInternalRef.current = generateChordsInternal;
    }, [generateChordsInternal]);

    const generateChords = useCallback(async (params: GenerationParams) => {
        const { numChords, customPrompt } = params;

        let usedPrompt: string;
        if (typeof customPrompt === 'string') {
            usedPrompt = customPrompt;
        } else {
            usedPrompt = prompt;
        }

        if (!usedPrompt.trim()) {
            showErrorToast("Input Error", "Please describe your chord progression before generating.");
            return;
        }

        const result = await generateChordsInternal(usedPrompt, chords, numChords);
        if (result) {
            setChords(result);
        }
    }, [prompt, chords, generateChordsInternal, setChords, showErrorToast]);


    const handleDragEnd = useCallback(
        ({ active, over }: DragEndEvent) => {
            if (!over || active.id === over.id) return;
            setChords((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                if (oldIndex === -1 || newIndex === -1) return items;
                return arrayMove(items, oldIndex, newIndex);
            });
        },
        [setChords]
    );

    const generateChordsFromExample = useCallback(
        (examplePrompt: string, numChordsForExample: number) => {
            if (typeof examplePrompt === 'string') {
                setPrompt(examplePrompt);
                generateChords({
                    numChords: numChordsForExample,
                    customPrompt: examplePrompt,
                });
            } else {
                console.error("generateChordsFromExample received a non-string prompt:", examplePrompt);
                showErrorToast("Input Error", "Invalid example prompt type.");
            }
        }, [generateChords, setPrompt, showErrorToast]);

    return {
        prompt, setPrompt,
        chords, setChords,
        fullLoading,
        generateChords,
        handleDragEnd,
        generateChordsFromExample,
    };
}