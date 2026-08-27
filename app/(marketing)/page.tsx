import React from 'react';
import Link from 'next/link';
import Script from 'next/script';
import type { Metadata } from 'next';
import {
    ArrowRight,
    Music,
    Piano,
    Download,
    Edit3,
    ChevronRight,
    GripVertical,
    Mic2,
    Headphones,
    BookOpen,
    FileMusic,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import HeroGenerator from '@/components/landing/HeroGenerator';
import ChordShowcase from '@/components/landing/ChordShowcase';
import { faqs } from '@/lib/constants';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
    title: 'AI Chord Progression Generator: Free, No Sign-Up | ChordGen',
    description: 'Generate chord progressions instantly from any mood, genre, or feeling. Interactive piano preview, drag-and-drop editing, free MIDI download for any DAW. No account needed.',
    alternates: { canonical: '/' },
};

const useCases = [
    {
        Icon: Mic2,
        title: 'Songwriters',
        description: 'Stuck on a song? Describe the feeling you\'re after and get something to start from. No theory needed.',
    },
    {
        Icon: Headphones,
        title: 'Producers',
        description: 'Skip drawing chords into the piano roll one note at a time. Generate a progression, then drag the MIDI straight into Ableton, FL Studio, or Logic.',
    },
    {
        Icon: Piano,
        title: 'Instrumentalists',
        description: 'Find chords you wouldn\'t have reached for on your own, and see exactly how each one is built on the piano.',
    },
    {
        Icon: BookOpen,
        title: 'Music students',
        description: 'See how progressions actually work across genres: blues turnarounds, neo-soul extensions, film-score cues.',
    },
];

const steps = [
    { number: '01', title: 'Describe', description: 'Type something like "melancholic jazz" or "upbeat pop anthem".' },
    { number: '02', title: 'Generate', description: 'You get three progressions back, each with a different take on it.' },
    { number: '03', title: 'Refine', description: 'Swap chords, reorder them, cut the ones that don\'t work.' },
    { number: '04', title: 'Export', description: 'Download the MIDI and drop it into your DAW.' },
];

const genres: [string, string][] = [
    ['lo-fi', 'Lo-Fi'],
    ['jazz', 'Jazz'],
    ['pop', 'Pop'],
    ['edm', 'EDM'],
    ['rnb', 'R&B'],
    ['rock', 'Rock'],
    ['blues', 'Blues'],
    ['neo-soul', 'Neo-Soul'],
    ['cinematic', 'Cinematic'],
    ['ambient', 'Ambient'],
    ['folk', 'Folk'],
    ['country', 'Country'],
    ['gospel', 'Gospel'],
    ['bossa-nova', 'Bossa Nova'],
];

const keys: [string, string][] = [
    ['c-major', 'C Major'],
    ['g-major', 'G Major'],
    ['d-major', 'D Major'],
    ['a-major', 'A Major'],
    ['e-major', 'E Major'],
    ['f-major', 'F Major'],
    ['a-minor', 'A Minor'],
    ['e-minor', 'E Minor'],
    ['d-minor', 'D Minor'],
    ['b-minor', 'B Minor'],
    ['f-sharp-minor', 'F♯ Minor'],
    ['c-minor', 'C Minor'],
];

const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
};

const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to generate a chord progression with ChordGen',
    description:
        'Generate AI-powered chord progressions from a text description, preview them on a piano, edit them, and export as MIDI.',
    totalTime: 'PT2M',
    step: steps.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.title,
        text: s.description,
        url: `https://www.chordgen.org/#step-${i + 1}`,
    })),
};

// Decorative key fills for the closing piano band — sampled from the app's
// root-note hues so the only color on the page always comes from the music.
const CTA_KEY_HUES: Record<number, number> = {
    2: 220, // C — blue
    6: 15, // F — red-orange
    9: 150, // G — teal
    13: 45, // A — amber
    17: 280, // D — purple
    20: 340, // E — rose
};

export default function LandingPage() {
    return (
        <div className="bg-gray-50 dark:bg-black overflow-hidden">
            {/* Hero */}
            <section className="relative px-4 pt-24 pb-16 sm:pt-32 sm:pb-20">
                <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
                    <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(125,125,125,0.10)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,black,transparent)]" />
                </div>

                <div className="mx-auto max-w-5xl text-center">
                    <h1 className="mb-4 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                        AI Chord Progression Generator
                    </h1>

                    <p className="mx-auto mb-10 text-base text-gray-500 dark:text-gray-400 sm:text-lg">
                        What should it sound like?
                    </p>

                    <HeroGenerator />

                    <Link
                        href="#how-it-works"
                        className="mt-10 inline-block text-sm text-gray-500 underline-offset-4 transition-colors hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-white"
                    >
                        See how it works
                    </Link>
                </div>
            </section>

            {/* The output — real progression cards */}
            <section className="px-4 pt-8 pb-24 sm:pt-12 sm:pb-32">
                <div className="mx-auto max-w-5xl">
                    <div className="mx-auto mb-16 max-w-3xl text-center">
                        <h2 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white sm:text-5xl">
                            This is what
                            <br className="hidden sm:block" /> you get back.
                        </h2>
                    </div>

                    <div className="space-y-10">
                        <ChordShowcase
                            prompt="warm nostalgic neo-soul"
                            title="Velvet Hours"
                            chords={['Cmaj9', 'Am11', 'Fmaj7', 'G13']}
                        />
                        <ChordShowcase
                            prompt="jazz in a minor"
                            title="Classic Minor Cadence"
                            chords={['Am7', 'Dm7', 'E7b9', 'Am7']}
                        />
                    </div>
                </div>
            </section>

            {/* Features — bento grid */}
            <section className="bg-white px-4 py-24 dark:bg-gray-950 sm:py-32">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-14 max-w-3xl">
                        <h2 className="mb-4 text-4xl font-black tracking-tight text-gray-900 dark:text-white sm:text-5xl">
                            What it does.
                        </h2>
                        <p className="text-lg font-medium text-gray-600 dark:text-gray-400 sm:text-xl">
                            Type a prompt, hear the chords, export the MIDI.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                        {/* Type it, don't pick it */}
                        <div className="lg:col-span-2">
                            <div className="group h-full rounded-3xl border border-gray-200 bg-gray-50 p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900 sm:p-10">
                                <Music className="mb-6 h-7 w-7 text-gray-900 dark:text-white" />
                                <h3 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">
                                    Type it, don&apos;t pick it
                                </h3>
                                <p className="mb-8 max-w-md leading-relaxed text-gray-600 dark:text-gray-400">
                                    No scale pickers, no preset menus. Say what you want in
                                    plain words and the chords get written around that, not
                                    filtered out of a list.
                                </p>
                                <div className="flex flex-wrap gap-2" aria-hidden>
                                    {['late-night drive', 'rainy day jazz', 'euphoric festival drop', 'bittersweet goodbye'].map((p) => (
                                        <span
                                            key={p}
                                            className="rounded-full border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-500 transition-colors duration-300 group-hover:border-gray-400 group-hover:text-gray-700 dark:border-gray-800 dark:text-gray-500 dark:group-hover:text-gray-300"
                                        >
                                            &ldquo;{p}&rdquo;
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Visual piano */}
                        <div>
                            <div className="group flex h-full flex-col rounded-3xl border border-gray-200 bg-gray-50 p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900 sm:p-10">
                                <Piano className="mb-6 h-7 w-7 text-gray-900 dark:text-white" />
                                <h3 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">
                                    Visual piano
                                </h3>
                                <p className="mb-8 leading-relaxed text-gray-600 dark:text-gray-400">
                                    Every chord shows up on a keyboard you can hear and play
                                    as you go.
                                </p>
                                <div className="relative mt-auto h-16" aria-hidden>
                                    <div className="flex h-full gap-[3px]">
                                        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                                            <div
                                                key={i}
                                                className={cn(
                                                    'flex-1 rounded-b-md border transition-colors duration-300',
                                                    [0, 2, 4].includes(i)
                                                        ? 'border-gray-400 bg-gray-300 dark:border-gray-500 dark:bg-gray-600'
                                                        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                                                )}
                                            />
                                        ))}
                                    </div>
                                    {[0, 1, 3, 4, 5].map((pos) => (
                                        <div
                                            key={pos}
                                            className="absolute top-0 h-[58%] rounded-b-md bg-gray-900 dark:bg-black dark:border dark:border-gray-700"
                                            style={{
                                                left: `calc(${pos + 1} * (100% / 7) - (100% / 7) * 0.3)`,
                                                width: 'calc((100% / 7) * 0.6)',
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Full control */}
                        <div>
                            <div className="group flex h-full flex-col rounded-3xl border border-gray-200 bg-gray-50 p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900 sm:p-10">
                                <Edit3 className="mb-6 h-7 w-7 text-gray-900 dark:text-white" />
                                <h3 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">
                                    Change anything
                                </h3>
                                <p className="mb-8 leading-relaxed text-gray-600 dark:text-gray-400">
                                    Drag chords around, swap one out, add or delete. Keep going
                                    until it sounds right.
                                </p>
                                <div className="mt-auto flex items-center gap-2" aria-hidden>
                                    {['Am7', 'Dm9', 'G13'].map((c, i) => (
                                        <span
                                            key={c}
                                            className={cn(
                                                'font-mono-accent inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-transform duration-300',
                                                i === 1
                                                    ? 'rotate-[-4deg] border-gray-900 bg-white text-gray-900 shadow-md group-hover:rotate-[3deg] dark:border-gray-200 dark:bg-gray-900 dark:text-white'
                                                    : 'border-gray-200 text-gray-700 dark:border-gray-800 dark:text-gray-300'
                                            )}
                                        >
                                            <GripVertical className="h-3.5 w-3.5 opacity-40" />
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Free MIDI */}
                        <div className="lg:col-span-2">
                            <div className="group h-full rounded-3xl border border-gray-200 bg-gray-50 p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900 sm:p-10">
                                <Download className="mb-6 h-7 w-7 text-gray-900 dark:text-white" />
                                <h3 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">
                                    Free MIDI, any DAW
                                </h3>
                                <p className="mb-8 max-w-md leading-relaxed text-gray-600 dark:text-gray-400">
                                    Plain .mid files, free, no account. Drag one into your
                                    session and keep working.
                                </p>
                                <div className="flex flex-wrap items-center gap-3" aria-hidden>
                                    <span className="font-mono-accent inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-white">
                                        <FileMusic className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                        progression.mid
                                    </span>
                                    <ArrowRight className="h-4 w-4 text-gray-400 transition-transform duration-300 group-hover:translate-x-1" />
                                    {['Ableton', 'FL Studio', 'Logic', 'Cubase'].map((daw) => (
                                        <span
                                            key={daw}
                                            className="rounded-full bg-gray-200/70 px-3.5 py-1.5 text-sm font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                        >
                                            {daw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How it works — editorial */}
            <section id="how-it-works" className="px-4 py-24 sm:py-32">
                <div className="mx-auto max-w-5xl">
                    <div className="mb-12 max-w-3xl">
                        <h2 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white sm:text-5xl">
                            How it
                            <br className="hidden sm:block" /> works.
                        </h2>
                    </div>

                    <div>
                        {steps.map((step, index) => (
                            <div
                                key={step.number}
                                id={`step-${index + 1}`}
                                className="grid grid-cols-1 items-baseline gap-x-10 gap-y-3 border-t border-gray-200 py-10 dark:border-gray-800 sm:grid-cols-[5rem_1fr] sm:py-12"
                            >
                                <span className="text-5xl font-black leading-none tabular-nums text-gray-200 dark:text-gray-800 sm:text-6xl">
                                    {step.number}
                                </span>
                                <div className="max-w-xl">
                                    <h3 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                                        {step.title}
                                    </h3>
                                    <p className="mt-3 text-lg leading-relaxed text-gray-600 dark:text-gray-400">
                                        {step.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Use cases — editorial list */}
            <section className="bg-white px-4 py-24 dark:bg-gray-950 sm:py-32">
                <div className="mx-auto max-w-5xl">
                    <div className="mb-14 max-w-3xl">
                        <h2 className="mb-4 text-4xl font-black tracking-tight text-gray-900 dark:text-white sm:text-5xl">
                            Who it&apos;s for.
                        </h2>
                        <p className="text-lg font-medium text-gray-600 dark:text-gray-400 sm:text-xl">
                            Songwriters, producers, players, and students.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-x-16 sm:grid-cols-2">
                        {useCases.map((useCase) => (
                            <div
                                key={useCase.title}
                                className="flex gap-5 border-b border-gray-200 py-8 dark:border-gray-800"
                            >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
                                    <useCase.Icon className="h-6 w-6 text-gray-900 dark:text-white" />
                                </div>
                                <div>
                                    <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
                                        {useCase.title}
                                    </h3>
                                    <p className="leading-relaxed text-gray-600 dark:text-gray-400">
                                        {useCase.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Browse by genre / key */}
            <section className="px-4 py-24 sm:py-32">
                <div className="mx-auto max-w-5xl">
                    <div className="mb-12 max-w-3xl">
                        <h2 className="mb-4 text-4xl font-black tracking-tight text-gray-900 dark:text-white sm:text-5xl">
                            Browse by genre or key.
                        </h2>
                        <p className="text-lg font-medium text-gray-600 dark:text-gray-400 sm:text-xl">
                            Chord references for common styles and keys.
                        </p>
                    </div>

                    <div>
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                            <div className="rounded-3xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
                                <h3 className="mb-5 text-xl font-bold text-gray-900 dark:text-white">
                                    Popular genres
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {genres.map(([slug, label]) => (
                                        <Link
                                            key={slug}
                                            href={`/chords/${slug}`}
                                            className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-900 hover:text-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:border-gray-200 dark:hover:text-white"
                                        >
                                            {label}
                                        </Link>
                                    ))}
                                </div>
                                <Link
                                    href="/chords"
                                    className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-gray-900 hover:underline dark:text-white"
                                >
                                    All genres <ChevronRight className="h-4 w-4" />
                                </Link>
                            </div>

                            <div className="rounded-3xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
                                <h3 className="mb-5 text-xl font-bold text-gray-900 dark:text-white">
                                    Common keys
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {keys.map(([slug, label]) => (
                                        <Link
                                            key={slug}
                                            href={`/key/${slug}`}
                                            className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-900 hover:text-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:border-gray-200 dark:hover:text-white"
                                        >
                                            {label}
                                        </Link>
                                    ))}
                                </div>
                                <Link
                                    href="/key"
                                    className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-gray-900 hover:underline dark:text-white"
                                >
                                    All keys <ChevronRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                            Coming from another chord tool?{' '}
                            <Link href="/chordchord-alternative" className="font-bold text-gray-900 hover:underline dark:text-white">
                                See how ChordGen compares as a free ChordChord alternative
                            </Link>
                        </p>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="bg-white px-4 py-24 dark:bg-gray-950 sm:py-32">
                <div className="mx-auto max-w-3xl">
                    <div className="mb-14">
                        <h2 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white sm:text-5xl">
                            Questions.
                        </h2>
                    </div>

                    <div>
                        <Accordion type="single" collapsible className="w-full">
                            {faqs.map((faq, index) => (
                                <AccordionItem
                                    key={index}
                                    value={`item-${index}`}
                                    className="border-b border-gray-200 dark:border-gray-800"
                                >
                                    <AccordionTrigger className="py-6 text-left text-lg font-semibold hover:no-underline">
                                        {faq.question}
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-6 text-base leading-relaxed text-gray-600 dark:text-gray-400">
                                        {faq.answer}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="px-4 py-24 sm:py-32">
                <div className="mx-auto max-w-4xl">
                    <div className="relative overflow-hidden rounded-[2.5rem] bg-gray-950 px-8 pt-16 pb-44 text-center dark:border dark:border-gray-800 sm:px-16 sm:pt-24 sm:pb-52">
                        <div className="relative">
                            <h2 className="mb-6 text-4xl font-black leading-tight text-white sm:text-5xl">
                                Your turn.
                            </h2>
                            <p className="mx-auto mb-10 max-w-xl text-lg text-gray-400 sm:text-xl">
                                One line is all it takes to get started.
                            </p>
                            <Button
                                asChild
                                size="lg"
                                className="rounded-2xl bg-white px-10 py-7 text-lg font-bold text-gray-900 shadow-2xl hover:bg-gray-100"
                            >
                                <Link href="/app">
                                    Launch ChordGen
                                    <ChevronRight className="ml-2 h-5 w-5" />
                                </Link>
                            </Button>
                        </div>

                        {/* Decorative piano band — color sampled from chord hues */}
                        <div aria-hidden className="absolute bottom-0 left-0 right-0 flex h-24 gap-px px-px sm:h-28">
                            {Array.from({ length: 24 }).map((_, i) => {
                                const hue = CTA_KEY_HUES[i];
                                return (
                                    <div
                                        key={i}
                                        className={cn(
                                            'flex-1 rounded-t-sm transition-colors duration-300',
                                            hue === undefined && 'bg-white/10 hover:bg-white/25'
                                        )}
                                        style={hue !== undefined ? { backgroundColor: `hsl(${hue}, 68%, 62%)` } : undefined}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            <Script
                id="faq-schema"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />
            <Script
                id="howto-schema"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
            />
        </div>
    );
}
