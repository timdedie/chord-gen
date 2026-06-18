// app/layout.tsx - Root layout with providers only

import "./globals.css";
import { Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import React from "react";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ClerkProvider } from "@clerk/nextjs";
import PostHogProvider from "@/components/providers/PostHogProvider";

import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from 'next';

const outfit = Outfit({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800", "900"],
    variable: "--font-outfit",
    display: "optional",
});

const unifiedDescription = 'Describe a mood, genre, or feeling, and our AI instantly generates unique chord progressions. Visualize on piano, edit, and download free MIDI files for any DAW.';

// Domain guard: defeats naive reverse-proxy mirrors (e.g. chord.lyricstosongai.com)
// by bouncing any non-allowlisted hostname back to the canonical site. Runs
// synchronously during parse, before hydration, so a verbatim proxy of our HTML
// redirects the visitor away.
const domainGuard = `(function(){try{var h=location.hostname;if(h==='www.chordgen.org'||h==='chordgen.org'||h==='localhost'||h==='127.0.0.1'||h.endsWith('.vercel.app'))return;location.replace('https://www.chordgen.org'+location.pathname+location.search+location.hash);}catch(e){}})();`;

const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "ChordGen",
    url: "https://www.chordgen.org",
    description: unifiedDescription,
    applicationCategory: "MusicApplication",
    operatingSystem: "ALL",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    image: "https://www.chordgen.org/chordgen_logo.png",
};

const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ChordGen",
    url: "https://www.chordgen.org",
    logo: "https://www.chordgen.org/chordgen_logo.png",
    description: unifiedDescription,
    email: "contact@chordgen.org",
    contactPoint: {
        "@type": "ContactPoint",
        email: "contact@chordgen.org",
        contactType: "customer support",
        url: "https://www.chordgen.org/contact",
    },
};

export const metadata: Metadata = {
    metadataBase: new URL('https://www.chordgen.org'),
    alternates: {
        canonical: '/',
    },

    title: {
        default: 'AI Chord Progression Generator from Text | ChordGen',
        template: '%s | ChordGen',
    },
    description: unifiedDescription,
    authors: [{ name: 'ChordGen Team', url: 'https://www.chordgen.org' }],
    creator: 'ChordGen',
    publisher: 'ChordGen',
    keywords: ['ai chord generator', 'chord progression generator', 'midi generator', 'chord maker', 'ai music generator', 'songwriting tool', 'free midi', 'natural language music'],

    icons: {
        icon: [
            { url: '/favicon.ico', type: 'image/x-icon' },
            { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
            { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
        ],
        apple: '/apple-touch-icon.png',
    },
    manifest: '/site.webmanifest',

    openGraph: {
        title: 'AI Chord Progression Generator from Text | ChordGen',
        description: unifiedDescription,
        url: 'https://www.chordgen.org/',
        siteName: 'ChordGen',
        images: [
            {
                url: '/og-image.png',
                width: 1200,
                height: 630,
                alt: 'ChordGen — generate AI chord progressions from a text prompt',
            },
        ],
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'AI Chord Progression Generator from Text | ChordGen',
        description: unifiedDescription,
        images: [
            { url: '/twitter-image.png', alt: 'ChordGen — AI chord progression generator' },
        ],
    },
};

export default function RootLayout({ children }: { children: React.ReactNode; }) {
    return (
        <ClerkProvider>
            <html lang="en">
            <body className={`${outfit.className} bg-gray-50 dark:bg-black`}>
                <script dangerouslySetInnerHTML={{ __html: domainGuard }} />
                <PostHogProvider>
                    {children}
                </PostHogProvider>
                <Analytics />
                <SpeedInsights />
                <SonnerToaster richColors position="bottom-right" />
            <Script id="webapp-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }} />
            <Script id="org-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
            </body>
            </html>
        </ClerkProvider>
    );
}
