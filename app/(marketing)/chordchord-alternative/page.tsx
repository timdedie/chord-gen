import React from 'react';
import Link from 'next/link';
import Script from 'next/script';
import type { Metadata } from 'next';
import { ArrowRight, Sparkles, Piano, Edit3, Download, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChordRow } from '@/components/ChordChip';

const title = 'Free ChordChord Alternative: AI Chord Progression Generator | ChordGen';
const description =
    'Looking for a free ChordChord alternative? ChordGen generates chord progressions from a text prompt, lets you preview them on an interactive piano, edit them freely, and export MIDI. No account, no subscription.';
const url = 'https://www.chordgen.org/chordchord-alternative';

export const metadata: Metadata = {
    title,
    description,
    alternates: { canonical: '/chordchord-alternative' },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
};

const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.chordgen.org' },
        { '@type': 'ListItem', position: 2, name: 'ChordChord Alternative', item: url },
    ],
};

const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: 'Is ChordGen really free?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. ChordGen has no account system, no paywalled features, and no usage limits. Generate and export as many progressions as you want, for free.',
            },
        },
        {
            '@type': 'Question',
            name: 'How is ChordGen different from other chord generators?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Instead of picking a key, scale, and mode from menus, you describe what you want in plain language, like "melancholic lo-fi" or "upbeat summer pop." An AI turns that into a chord progression and checks it against music theory before it reaches you.',
            },
        },
        {
            '@type': 'Question',
            name: 'Can I export what I create?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. Every progression can be downloaded as a standard MIDI file and imported into any DAW: Ableton, Logic, FL Studio, GarageBand, and more.',
            },
        },
    ],
};

const features = [
    {
        Icon: Sparkles,
        title: 'Describe it in words',
        body: 'Skip the dropdowns. Type a mood, genre, or reference, like "warm Sunday-morning piano," and get a progression that matches it.',
    },
    {
        Icon: Piano,
        title: 'Interactive piano preview',
        body: 'Hear every chord on a playable on-screen keyboard before you commit to it.',
    },
    {
        Icon: Edit3,
        title: 'Drag-and-drop editing',
        body: 'Swap a chord you don\'t like, reorder the progression, or extend it. The keyboard updates as you go.',
    },
    {
        Icon: Download,
        title: 'Free MIDI export',
        body: 'Download your progression as a standard MIDI file and drop it straight into your DAW.',
    },
];

const comparisonRows: { label: string; chordgen: string | boolean; others: string | boolean }[] = [
    { label: 'Price', chordgen: 'Free', others: 'Often free-to-try, paid for full features' },
    { label: 'Account required', chordgen: false, others: 'Commonly required' },
    { label: 'Generate from a text prompt', chordgen: true, others: 'Varies by tool' },
    { label: 'Interactive piano preview', chordgen: true, others: 'Varies by tool' },
    { label: 'Drag-and-drop chord editing', chordgen: true, others: 'Varies by tool' },
    { label: 'MIDI export', chordgen: true, others: 'Sometimes limited to paid plans' },
];

export default function ChordChordAlternative() {
    return (
        <div className="bg-gray-50 dark:bg-black">
            <article className="px-4 py-20">
                <div className="max-w-3xl mx-auto">
                    <nav className="text-sm text-gray-500 dark:text-gray-500 mb-6" aria-label="Breadcrumb">
                        <Link href="/" className="hover:text-primary">Home</Link>
                        <span className="mx-2">/</span>
                        <span>ChordChord Alternative</span>
                    </nav>

                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-gray-900 dark:text-white mb-6 leading-tight">
                        Looking for a free ChordChord alternative?
                    </h1>

                    <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-12 font-medium leading-relaxed">
                        ChordGen is a free AI chord progression generator. Describe a mood in plain words, preview the
                        result on an interactive piano, edit it until it&apos;s right, and export it as MIDI.
                        No account, no subscription, no limits.
                    </p>

                    <div className="prose prose-lg dark:prose-invert max-w-none mb-16">
                        <p>
                            People searching for a &ldquo;ChordChord alternative&rdquo; are usually after one of a few
                            things: a tool that&apos;s free without a catch, one that doesn&apos;t make you create an
                            account just to try it, or one that stays out of the way and lets you focus on writing music.
                            That&apos;s the gap ChordGen fills. It&apos;s a fast, no-friction way to go from an idea to a
                            playable, exportable chord progression.
                        </p>
                        <p>
                            The biggest difference is how you start. Instead of picking a key, scale, and mode from
                            menus and getting back a sequence filtered from that scale, you just type what you&apos;re
                            after: &ldquo;melancholic jazz,&rdquo; &ldquo;driving synthwave,&rdquo; &ldquo;like a quiet
                            Sunday morning.&rdquo; An AI turns that description into a musically coherent progression
                            and checks it against real music theory before it reaches you.
                        </p>
                    </div>

                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-8">
                        What ChordGen offers
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-16">
                        {features.map((f) => (
                            <div
                                key={f.title}
                                className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                            >
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <f.Icon className="h-6 w-6 text-primary" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                    {f.title}
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                                    {f.body}
                                </p>
                            </div>
                        ))}
                    </div>

                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">
                        Try a generated progression
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                        Here&apos;s what a prompt like <em>&ldquo;melancholic lo-fi in A minor&rdquo;</em> might produce:
                    </p>
                    <div className="mb-16 p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                        <ChordRow chords={['Am7', 'Fmaj7', 'Cmaj7', 'G7']} large />
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
                            A loop in the style of i–♭VI–♭III–♭VII in A minor. It&apos;s the kind of warm, slightly
                            wistful progression that anchors a lot of lo-fi and bedroom-pop production.
                        </p>
                    </div>

                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">
                        How ChordGen compares
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                        Every tool in this space has its own strengths. Here&apos;s what ChordGen guarantees, set
                        against what&apos;s common across chord-generation tools more broadly.
                    </p>
                    <div className="mb-16 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                        <table className="w-full text-sm sm:text-base">
                            <thead>
                                <tr className="bg-white dark:bg-gray-900 text-left">
                                    <th className="px-5 py-4 font-bold text-gray-900 dark:text-white">Feature</th>
                                    <th className="px-5 py-4 font-bold text-primary">ChordGen</th>
                                    <th className="px-5 py-4 font-bold text-gray-500 dark:text-gray-400">Typical alternatives</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparisonRows.map((row, i) => (
                                    <tr
                                        key={row.label}
                                        className={i % 2 === 0 ? 'bg-gray-50 dark:bg-black' : 'bg-white dark:bg-gray-900'}
                                    >
                                        <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">{row.label}</td>
                                        <td className="px-5 py-4 text-gray-700 dark:text-gray-300">
                                            {typeof row.chordgen === 'boolean' ? (
                                                row.chordgen ? (
                                                    <Check className="h-5 w-5 text-primary" aria-label="Yes" />
                                                ) : (
                                                    <X className="h-5 w-5 text-gray-400" aria-label="No" />
                                                )
                                            ) : (
                                                row.chordgen
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-gray-500 dark:text-gray-500">
                                            {typeof row.others === 'boolean' ? (
                                                row.others ? (
                                                    <Check className="h-5 w-5" aria-label="Yes" />
                                                ) : (
                                                    <X className="h-5 w-5" aria-label="No" />
                                                )
                                            ) : (
                                                row.others
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mb-16 leading-relaxed">
                        &ldquo;Typical alternatives&rdquo; reflects general patterns across chord-generation tools,
                        not a claim about any specific product. Feature sets and pricing change often, so check a
                        tool&apos;s own site for current details.
                    </p>

                    <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-10 mb-16">
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">
                            Try ChordGen free
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                            No account, no sign-up, no payment ever. Describe what you want, hear it instantly, and
                            download every progression as MIDI.
                        </p>
                        <Button asChild size="lg" className="font-bold">
                            <Link href="/app">
                                Open the chord generator <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                        </Button>
                    </div>

                </div>
            </article>

            <Script
                id="breadcrumb-schema-chordchord-alt"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />
            <Script
                id="faq-schema-chordchord-alt"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />
        </div>
    );
}
