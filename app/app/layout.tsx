import React from 'react';
import type { Metadata } from 'next';
import AppShell from './AppShell';

export const metadata: Metadata = {
    title: {
        absolute: 'ChordGen',
    },
    description: 'Generate AI-powered chord progressions from text descriptions. Visualize on piano, edit, and download free MIDI files.',
    alternates: {
        canonical: '/app',
    },
    // The public entry point for the generator is "/", which carries the same
    // input plus the crawlable marketing content. /app is the in-app shell
    // (sidebar, saved progressions) and would otherwise compete with the
    // homepage for the same head term.
    robots: { index: false, follow: true },
};

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AppShell>{children}</AppShell>;
}
