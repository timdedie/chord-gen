import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import DarkModeToggle from '@/components/DarkModeToggle';

export function Footer() {
    return (
        <footer className="w-full bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800">
            <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12">
                    <div>
                        <Link href="/" className="flex items-center gap-2 mb-3">
                            <Image
                                src="/chordgen_logo_small.png"
                                alt="ChordGen Logo"
                                width={64}
                                height={64}
                                className="h-6 w-6 dark:invert"
                            />
                            <span className="font-bold text-gray-900 dark:text-gray-100">ChordGen</span>
                        </Link>
                        <p className="text-sm text-gray-500 dark:text-gray-500 leading-relaxed">
                            The free AI chord progression generator. Describe a mood, get progressions, download MIDI.
                        </p>
                    </div>

                    <nav>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Product</h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link href="/app" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                                    Generator
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                                    Contact
                                </Link>
                            </li>
                        </ul>
                    </nav>

                </div>

                <div className="pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-500">
                    <p>&copy; {new Date().getFullYear()} ChordGen. All rights reserved.</p>
                    <a href="https://dang.ai" rel="dofollow" className="sr-only">
                        Verified on DANG!
                    </a>
                    <DarkModeToggle />
                </div>
            </div>
        </footer>
    );
}
