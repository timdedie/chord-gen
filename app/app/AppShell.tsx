'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import PianoProvider from '@/components/PianoProvider';
import WelcomeAfterSignUp from '@/components/WelcomeAfterSignUp';

const AppSidebar = dynamic(() => import('@/components/layouts/AppSidebar'), { ssr: false });

export default function AppShell({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <PianoProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-black">
                <AppSidebar />
                <main className="flex-1 md:ml-14">
                    {children}
                </main>
                <WelcomeAfterSignUp />
            </div>
        </PianoProvider>
    );
}
