'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

const majorKeys: [string, string][] = [
    ['c-major', 'C Major'],
    ['g-major', 'G Major'],
    ['d-major', 'D Major'],
    ['a-major', 'A Major'],
    ['e-major', 'E Major'],
    ['f-major', 'F Major'],
    ['b-flat-major', 'B♭ Major'],
    ['e-flat-major', 'E♭ Major'],
];

const minorKeys: [string, string][] = [
    ['a-minor', 'A Minor'],
    ['e-minor', 'E Minor'],
    ['d-minor', 'D Minor'],
    ['b-minor', 'B Minor'],
    ['f-sharp-minor', 'F♯ Minor'],
    ['c-sharp-minor', 'C♯ Minor'],
    ['c-minor', 'C Minor'],
    ['g-minor', 'G Minor'],
];

function NavPopover({
    label,
    children,
    width = 'w-80',
}: {
    label: string;
    children: React.ReactNode;
    width?: string;
}) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 text-[15px] text-gray-900 transition-colors hover:text-primary dark:text-gray-100">
                    {label}
                    <ChevronDown className="h-4 w-4 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className={`${width} p-3`}>
                {children}
            </PopoverContent>
        </Popover>
    );
}

function NavLink({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="block px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary transition-colors"
        >
            {label}
        </Link>
    );
}

function FooterLink({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="block px-3 py-2 rounded-md text-sm font-semibold text-primary hover:underline"
        >
            {label} →
        </Link>
    );
}

export function MarketingHeader() {
    // Tinted to the page surface (gray-50 / black), not --background: that
    // token is pure white and read as a separate band sitting on the page.
    return (
        <header className="sticky top-0 z-50 w-full bg-gray-50/80 backdrop-blur-md dark:bg-black/80">
            <div className="flex h-20 w-full items-center justify-between px-6 sm:px-8">
                {/* Left cluster: wordmark + nav, OpenAI-style */}
                <div className="flex items-center gap-8 lg:gap-10">
                    <Link href="/" className="flex flex-shrink-0 items-center gap-2">
                        <Image
                            src="/chordgen_logo_small.png"
                            alt="ChordGen Logo"
                            width={64}
                            height={64}
                            className="h-7 w-7 dark:invert"
                            priority
                        />
                        <span className="text-lg font-bold tracking-tight">ChordGen</span>
                    </Link>

                    <nav className="hidden items-center gap-7 md:flex lg:gap-9">
                        <NavPopover label="Genres">
                            <div className="grid grid-cols-2 gap-1">
                                {genres.map(([slug, label]) => (
                                    <NavLink key={slug} href={`/chords/${slug}`} label={label} />
                                ))}
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-800 mt-2 pt-2">
                                <FooterLink href="/chords" label="All genres" />
                            </div>
                        </NavPopover>

                        <NavPopover label="Keys">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="px-3 pt-1 pb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-500">
                                        Major
                                    </p>
                                    {majorKeys.map(([slug, label]) => (
                                        <NavLink key={slug} href={`/key/${slug}`} label={label} />
                                    ))}
                                </div>
                                <div>
                                    <p className="px-3 pt-1 pb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-500">
                                        Minor
                                    </p>
                                    {minorKeys.map(([slug, label]) => (
                                        <NavLink key={slug} href={`/key/${slug}`} label={label} />
                                    ))}
                                </div>
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-800 mt-2 pt-2">
                                <FooterLink href="/key" label="All keys" />
                            </div>
                        </NavPopover>

                        <Link
                            href="/blog"
                            className="text-[15px] text-gray-900 transition-colors hover:text-primary dark:text-gray-100"
                        >
                            Blog
                        </Link>
                    </nav>
                </div>

                <Button asChild size="lg" className="flex-shrink-0 rounded-full px-6 font-semibold">
                    <Link href="/app">Try ChordGen</Link>
                </Button>
            </div>
        </header>
    );
}

export default MarketingHeader;
