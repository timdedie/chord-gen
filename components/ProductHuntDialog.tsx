'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
} from '@/components/ui/dialog';

const SEEN_KEY = 'producthunt-launch-dialog-shown';
const SHOW_DELAY_MS = 4000;
// June 16, 2026 12:01 AM PDT
const LAUNCH_TIME = new Date('2026-06-16T07:01:00Z').getTime();

export default function ProductHuntDialog({ trigger }: { trigger: boolean }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!trigger) return;
        if (Date.now() < LAUNCH_TIME) return;
        if (localStorage.getItem(SEEN_KEY)) return;

        const timer = setTimeout(() => {
            localStorage.setItem(SEEN_KEY, '1');
            setOpen(true);
        }, SHOW_DELAY_MS);

        return () => clearTimeout(timer);
    }, [trigger]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md text-center lowercase p-10 gap-6">
                <DialogHeader className="items-center text-center sm:text-center gap-5">
                    <Image
                        src="/chordgen_logo.svg"
                        alt="ChordGen"
                        width={72}
                        height={72}
                        className="h-18 w-18 object-contain"
                    />
                    <DialogDescription className="text-sm leading-relaxed space-y-3">
                        <p>hey, thanks for using chordgen :)</p>
                        <p>
                            we just launched on product hunt today, if you have a minute,
                            an upvote would mean a lot and really helps us get noticed.
                        </p>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="sm:justify-center">
                    <a
                        href="https://www.producthunt.com/products/chordgen"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-600 dark:bg-blue-500 text-white shadow px-5 py-2.5 font-medium transition-transform hover:scale-105"
                    >
                        check it out on product hunt →
                    </a>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
