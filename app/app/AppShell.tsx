'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import PianoProvider from '@/components/PianoProvider';
import WelcomeAfterSignUp from '@/components/WelcomeAfterSignUp';
import { SidebarProvider, useSidebar } from '@/components/layouts/SidebarProvider';

const AppSidebar = dynamic(() => import('@/components/layouts/AppSidebar'), { ssr: false });

function ShellInner({ children }: { children: React.ReactNode }) {
    const { collapsed } = useSidebar();
    return (
        <div
            className="min-h-screen bg-gray-50 dark:bg-black"
            style={{ '--sidebar-w': collapsed ? '3.5rem' : '14rem' } as React.CSSProperties}
        >
            <AppSidebar />
            <main className="flex-1 transition-[margin] duration-200 md:ml-[var(--sidebar-w)]">
                {children}
            </main>
            <WelcomeAfterSignUp />
        </div>
    );
}

export default function AppShell({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <PianoProvider>
            <SidebarProvider>
                <ShellInner>{children}</ShellInner>
            </SidebarProvider>
        </PianoProvider>
    );
}
