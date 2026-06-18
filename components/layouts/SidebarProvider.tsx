'use client';

import React, { createContext, useContext, useState } from 'react';

interface SidebarContextValue {
    collapsed: boolean;
    setCollapsed: (value: boolean) => void;
    toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(true);
    return (
        <SidebarContext.Provider
            value={{ collapsed, setCollapsed, toggle: () => setCollapsed((c) => !c) }}
        >
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const ctx = useContext(SidebarContext);
    if (!ctx) throw new Error('useSidebar must be used within a SidebarProvider');
    return ctx;
}
