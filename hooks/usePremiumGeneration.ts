'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useUser } from '@clerk/nextjs';

export interface UsePremiumGenerationReturn {
    isSignedIn: boolean;
    available: boolean;
    loading: boolean;
    enabled: boolean;
    used: number;
    limit: number;
    remaining: number;
    unlimited: boolean;
    toggle: () => void;
    consume: () => void;
    refresh: () => void;
}

interface Status {
    used: number;
    limit: number;
    unlimited: boolean;
}

const EMPTY: Status = { used: 0, limit: 0, unlimited: false };

// Session-scoped, in-memory toggle store.
//
// Intentionally NOT persisted to localStorage/sessionStorage: the premium
// toggle should default to OFF on every fresh page load. Activating it keeps it
// on across client-side navigation within the app (this module stays alive), but
// a full reload or leaving and coming back later reinitializes the module, so it
// resets to off. A small subscriber set keeps any mounted hook instances in sync.
let enabledState = false;
const listeners = new Set<() => void>();

function setEnabledState(next: boolean) {
    if (enabledState === next) return;
    enabledState = next;
    listeners.forEach((l) => l());
}

function subscribeEnabled(cb: () => void) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}

const getEnabledSnapshot = () => enabledState;
const getEnabledServerSnapshot = () => false;

export function usePremiumGeneration(): UsePremiumGenerationReturn {
    const { isSignedIn, isLoaded } = useUser();
    const [status, setStatus] = useState<Status>(EMPTY);
    const [statusLoaded, setStatusLoaded] = useState(false);
    const rawEnabled = useSyncExternalStore(
        subscribeEnabled,
        getEnabledSnapshot,
        getEnabledServerSnapshot
    );

    const refresh = useCallback(() => {
        if (!isSignedIn) return;
        fetch('/api/premium-status', { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => {
                setStatus({
                    used: Number(data.used ?? 0),
                    limit: Number(data.limit ?? 0),
                    unlimited: Boolean(data.unlimited),
                });
                setStatusLoaded(true);
            })
            .catch(() => {
                setStatus(EMPTY);
                setStatusLoaded(true);
            });
    }, [isSignedIn]);

    useEffect(() => {
        if (!isLoaded) return;
        refresh();
    }, [isLoaded, refresh]);

    // Re-read availability whenever the page is shown again (tab focus, or a
    // back/forward navigation restoring a bfcached page). Without this, a page
    // left mounted keeps stale availability after generations are consumed
    // elsewhere — the source of the app/results inconsistency.
    useEffect(() => {
        if (!isLoaded) return;
        const onVisible = () => {
            if (document.visibilityState === 'visible') refresh();
        };
        window.addEventListener('focus', refresh);
        window.addEventListener('pageshow', refresh);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.removeEventListener('focus', refresh);
            window.removeEventListener('pageshow', refresh);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [isLoaded, refresh]);

    // Treat status as empty once the user is signed out, without discarding
    // the fetched state (it's reused if they sign back in).
    const effectiveStatus = isSignedIn ? status : EMPTY;
    // Availability is always accurate — never optimistic. We only report premium
    // as available once we've actually confirmed remaining quota with the server,
    // so a user with nothing left can never click the toggle (not even briefly).
    const available =
        effectiveStatus.unlimited || effectiveStatus.used < effectiveStatus.limit;

    // While Clerk resolves or the status request is in flight for a signed-in
    // user, we don't yet know the quota. `loading` lets the toggle show a neutral
    // "checking" state instead of looking like a dead/disabled button.
    const loading = !isLoaded || (Boolean(isSignedIn) && !statusLoaded);

    const enabled = Boolean(isSignedIn) && rawEnabled;

    // Reconcile the toggle once we know it can no longer be used: the user is
    // signed out, or we've confirmed there's no premium left for today.
    useEffect(() => {
        if (!isLoaded) return;
        if (!isSignedIn) {
            setEnabledState(false);
            return;
        }
        if (statusLoaded && !available) setEnabledState(false);
    }, [isLoaded, isSignedIn, statusLoaded, available]);

    const toggle = useCallback(() => {
        if (!isSignedIn || !available) return;
        setEnabledState(!enabledState);
    }, [isSignedIn, available]);

    // Called after a premium generation lands. Bump the count optimistically
    // so the UI reflects the use immediately, then reconcile with the server
    // (a fresh status fetch can lag the generation's DB write). The toggle
    // stays on for the next generation as long as premium is still available;
    // the effect above turns it off once the quota is exhausted.
    const consume = useCallback(() => {
        setStatus((s) => (s.unlimited ? s : { ...s, used: s.used + 1 }));
        refresh();
    }, [refresh]);

    return {
        isSignedIn: Boolean(isSignedIn),
        available,
        loading,
        enabled,
        used: effectiveStatus.used,
        limit: effectiveStatus.limit,
        remaining: effectiveStatus.unlimited
            ? Infinity
            : Math.max(0, effectiveStatus.limit - effectiveStatus.used),
        unlimited: effectiveStatus.unlimited,
        toggle,
        consume,
        refresh,
    };
}
