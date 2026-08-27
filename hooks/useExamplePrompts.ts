import { useState, useEffect, useCallback } from 'react';
// Assuming your example inputs are in public/example-inputs.json
// The import path might need adjustment based on your tsconfig.json baseUrl or path aliases
import exampleInputsFromFile from '@/public/example-inputs.json';

const allExamples = exampleInputsFromFile as string[];

function pickRandomExamples(count: number): string[] {
    const shuffled = [...allExamples];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, Math.min(count, allExamples.length));
}

export function useExamplePrompts(numberOfRandomExamples: number = 5) {
    // Seed with a deterministic slice so the server HTML and the first client
    // render agree — randomising during render hydration-mismatches. The real
    // shuffle happens on mount, which the server never runs.
    const [randomExamples, setRandomExamples] = useState<string[]>(() =>
        allExamples.slice(0, Math.min(numberOfRandomExamples, allExamples.length))
    );

    // Intentional post-hydration setState: the randomness has to land after the
    // server HTML is matched, so it cannot happen during render.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRandomExamples(pickRandomExamples(numberOfRandomExamples));
    }, [numberOfRandomExamples]);

    // Function to allow refreshing the random examples on demand
    const pickNewRandomExamples = useCallback(() => {
        setRandomExamples(pickRandomExamples(numberOfRandomExamples));
    }, [numberOfRandomExamples]);

    return {
        allExamples,        // In case you need the full list elsewhere
        randomExamples,
        pickNewRandomExamples // Function to allow refreshing the random examples if needed
    };
}
