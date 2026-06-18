"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

if (typeof window !== "undefined" && POSTHOG_KEY && !posthog.__loaded) {
    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        // Only create billable person profiles for users we actually identify
        // (i.e. signed-in Clerk users). Anonymous visitors still generate
        // events but don't burn into the person count — important at a
        // freemium ratio where most traffic never signs up.
        person_profiles: "identified_only",
        // We capture pageviews manually below to handle App Router client-side
        // navigations correctly. Leave-page events stay automatic.
        capture_pageview: false,
        capture_pageleave: true,
        // Session replay is opt-in and sampled — the Tone.js / react-piano
        // interaction surface is noisy and full replay would bloat volume.
        disable_session_recording: true,
    });
}

/** Fires a $pageview on every App Router navigation (incl. query changes). */
function PostHogPageview() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!POSTHOG_KEY || !pathname) return;
        let url = window.origin + pathname;
        const qs = searchParams?.toString();
        if (qs) url += `?${qs}`;
        posthog.capture("$pageview", { $current_url: url });
    }, [pathname, searchParams]);

    return null;
}

/** Ties PostHog identity to Clerk: identify on sign-in, reset on sign-out. */
function PostHogIdentify() {
    const { isSignedIn, userId, isLoaded } = useAuth();
    const { user } = useUser();

    useEffect(() => {
        if (!POSTHOG_KEY || !isLoaded) return;

        if (isSignedIn && userId) {
            const role =
                (user?.publicMetadata?.role as string | undefined) ?? "free";
            posthog.identify(userId, {
                role,
                email: user?.primaryEmailAddress?.emailAddress,
                created_at: user?.createdAt
                    ? new Date(user.createdAt).toISOString()
                    : undefined,
            });
        } else if (!isSignedIn) {
            // Clear the identified person so the next visitor on this device
            // isn't merged into the previous user's profile.
            posthog.reset();
        }
    }, [isLoaded, isSignedIn, userId, user]);

    return null;
}

export default function PostHogProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    // When unconfigured, render children untouched so dev/CI work without keys.
    if (!POSTHOG_KEY) return <>{children}</>;

    return (
        <PHProvider client={posthog}>
            <Suspense fallback={null}>
                <PostHogPageview />
            </Suspense>
            <PostHogIdentify />
            {children}
        </PHProvider>
    );
}
