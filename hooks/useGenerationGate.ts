'use client';

import { useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { capture, AnalyticsEvent } from '@/lib/analytics/events';

const STORAGE_KEY = 'chordgen_guest_usage';
const FREE_LIMIT = 5;

interface UsageData {
    count: number;
    date: string; // YYYY-MM-DD
}

function todayDate(): string {
    return new Date().toISOString().slice(0, 10);
}

export interface UseGenerationGateReturn {
    checkAndGate: () => boolean;
    incrementCount: () => void;
    guestCount: number;
    paywallOpen: boolean;
    setPaywallOpen: (open: boolean) => void;
}

export function useGenerationGate(): UseGenerationGateReturn {
    const { isSignedIn, isLoaded } = useUser();
    const [paywallOpen, setPaywallOpen] = useState(false);

    const getUsage = useCallback((): UsageData => {
        if (typeof window === 'undefined') return { count: 0, date: todayDate() };
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed: UsageData = JSON.parse(raw);
                if (parsed.date === todayDate()) return parsed;
            }
        } catch {
            // ignore malformed data
        }
        return { count: 0, date: todayDate() };
    }, []);

    const checkAndGate = useCallback((): boolean => {
        if (!isLoaded) return true;
        if (isSignedIn) return true;
        const { count } = getUsage();
        if (count < FREE_LIMIT) return true;
        capture(AnalyticsEvent.PaywallShown, { free_limit: FREE_LIMIT, count });
        setPaywallOpen(true);
        return false;
    }, [isLoaded, isSignedIn, getUsage]);

    const incrementCount = useCallback(() => {
        if (isSignedIn) return;
        const usage = getUsage();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: usage.count + 1, date: todayDate() }));
    }, [isSignedIn, getUsage]);

    const guestCount = isSignedIn ? 0 : getUsage().count;

    return { checkAndGate, incrementCount, guestCount, paywallOpen, setPaywallOpen };
}
