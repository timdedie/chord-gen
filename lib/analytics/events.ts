"use client";

import posthog from "posthog-js";

/**
 * Central catalog of product analytics events. Keeping the names in one typed
 * map prevents typos and drift between call sites, and documents the funnel:
 *
 *   generate → activate (play / explain / edit) → value (MIDI export)
 *            → gate (paywall) → convert (signup) → support (paypal / premium)
 *
 * Client events flow through `capture()` below. Server-side events live in
 * `lib/analytics/posthog-server.ts` and use the same string names so they line
 * up in the same PostHog funnel.
 */
export const AnalyticsEvent = {
    // Funnel: generation
    GenerationRequested: "generation_requested",
    GenerationFailed: "generation_failed",
    GenerateMoreClicked: "generate_more_clicked",
    FeedbackSubmitted: "feedback_submitted",

    // Funnel: activation / value
    ProgressionPlayed: "progression_played",
    ProgressionExplained: "progression_explained",
    ProgressionEdited: "progression_edited",
    MidiExported: "midi_exported",

    // Funnel: premium / gating
    PremiumToggled: "premium_toggled",
    PaywallShown: "paywall_shown",
    PaywallCtaClicked: "paywall_cta_clicked",

    // Funnel: conversion / support (monetization is signup + PayPal donations)
    SignupCompleted: "signup_completed",
    PaypalSupportClicked: "paypal_support_clicked",
} as const;

export type AnalyticsEventName =
    (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

type EventProps = Record<string, string | number | boolean | null | undefined>;

/**
 * Capture a product event from the client. No-ops safely when PostHog isn't
 * configured (e.g. local dev without keys) so call sites never need to guard.
 */
export function capture(event: AnalyticsEventName, properties?: EventProps): void {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.capture(event, properties);
}
