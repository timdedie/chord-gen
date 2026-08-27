'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export function MarketingHeader() {
    // Tinted to the page surface (gray-50 / black), not --background: that
    // token is pure white and read as a separate band sitting on the page.
    return (
        <header className="sticky top-0 z-50 w-full bg-gray-50/80 backdrop-blur-md dark:bg-black/80">
            <div className="flex h-20 w-full items-center justify-between px-6 sm:px-8">
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

                <Button asChild size="lg" className="flex-shrink-0 rounded-full px-6 font-semibold">
                    <Link href="/app">Try ChordGen</Link>
                </Button>
            </div>
        </header>
    );
}

export default MarketingHeader;
