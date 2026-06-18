'use client';

import React from 'react';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { capture, AnalyticsEvent } from '@/lib/analytics/events';

interface PaywallModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PaywallModal({ open, onOpenChange }: PaywallModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        You&apos;ve used your 5 free generations
                    </DialogTitle>
                    <DialogDescription className="text-base pt-1">
                        Create a free account to keep generating unlimited chord progressions.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-2 pt-2">
                    <SignUpButton mode="modal">
                        <Button
                            className="w-full rounded-full font-semibold"
                            size="lg"
                            onClick={() => capture(AnalyticsEvent.PaywallCtaClicked, { cta: 'sign_up' })}
                        >
                            Create free account
                        </Button>
                    </SignUpButton>

                    <SignInButton mode="modal">
                        <Button
                            variant="outline"
                            className="w-full rounded-full"
                            size="lg"
                            onClick={() => capture(AnalyticsEvent.PaywallCtaClicked, { cta: 'sign_in' })}
                        >
                            Sign in
                        </Button>
                    </SignInButton>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default PaywallModal;
