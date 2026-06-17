'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, SquarePen, Moon, Sun, Monitor, User, Settings, Heart, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useUser, UserButton, SignInButton, SignUpButton } from '@clerk/nextjs';

type Theme = 'light' | 'dark' | 'system';

export function AppSidebar() {
    const [collapsed, setCollapsed] = useState(true);
    const [theme, setTheme] = useState<Theme>('system');
    const { isSignedIn, isLoaded } = useUser();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage, unavailable during SSR
            setTheme((localStorage.getItem('theme') as Theme) || 'system');
        }
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light';
            root.classList.add(systemTheme);

            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = (e: MediaQueryListEvent) => {
                root.classList.toggle('dark', e.matches);
            };
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        } else {
            root.classList.add(theme);
        }
    }, [theme]);

    const handleThemeChange = (value: Theme) => {
        setTheme(value);
        localStorage.setItem('theme', value);
    };

    return (
        <aside
            onClick={() => {
                if (collapsed) setCollapsed(false);
            }}
            className={`hidden md:flex flex-col fixed top-0 left-0 h-screen bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 transition-all duration-200 z-40 ${
                collapsed ? 'w-14 cursor-pointer' : 'w-56'
            }`}
        >
            {/* Top section: Logo and collapse toggle */}
            <div className="flex items-center justify-between h-16 px-3">
                <Link href="/" className="flex items-center gap-2 overflow-hidden">
                    <Image
                        src="/chordgen_logo_small.png"
                        alt="ChordGen Logo"
                        width={32}
                        height={32}
                        className="h-8 w-8 flex-shrink-0 dark:invert"
                        priority
                    />
                    {!collapsed && (
                        <span className="text-lg font-bold whitespace-nowrap">ChordGen</span>
                    )}
                </Link>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        setCollapsed(!collapsed);
                    }}
                    className="h-8 w-8 flex-shrink-0"
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {/* New progression button */}
            <div className="p-2">
                <Button
                    asChild
                    variant="ghost"
                    size={collapsed ? "icon" : "default"}
                    className={`w-full ${collapsed ? '' : 'justify-start'}`}
                >
                    <Link href="/app">
                        <SquarePen className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span className="ml-2">New Progression</span>}
                    </Link>
                </Button>
            </div>

            {/* Middle section */}
            <nav className="flex-1 py-4 px-2">
                <Button
                    asChild
                    variant="ghost"
                    size={collapsed ? "icon" : "default"}
                    className={`w-full ${collapsed ? '' : 'justify-start'}`}
                >
                    <Link href="/app/saved">
                        <Heart className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span className="ml-2">Saved</span>}
                    </Link>
                </Button>
            </nav>

            {/* Bottom section: Buy me a coffee → Settings → Account */}
            <div className="flex flex-col gap-1 p-2 pb-3">
                {!collapsed && (
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" className="w-full justify-start">
                                <Coffee className="h-4 w-4 flex-shrink-0" />
                                <span className="ml-2">Buy me a coffee</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-sm">
                            <DialogHeader>
                                <DialogTitle>buy me a coffee :)</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-muted-foreground lowercase">
                                i&apos;m trying to keep chordgen running for free, but if you&apos;d like to help out here&apos;s my paypal. thank you :)
                            </p>
                            <Button asChild className="w-full mt-2">
                                <a href="https://www.paypal.com/paypalme/timdedie" target="_blank" rel="noopener noreferrer">
                                    <Image src="/paypal/paypal-logo.png" alt="PayPal" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
                                    <span className="ml-2">Buy me a coffee on PayPal</span>
                                </a>
                            </Button>
                        </DialogContent>
                    </Dialog>
                )}
                {/* Settings */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size={collapsed ? "icon" : "default"}
                            className={`w-full ${collapsed ? '' : 'justify-start'}`}
                            aria-label="Settings"
                        >
                            <Settings className="h-4 w-4 flex-shrink-0" />
                            {!collapsed && <span className="ml-2">Settings</span>}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[560px] max-w-[90vw] h-[420px] p-0 flex flex-col overflow-hidden">
                        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
                            <DialogTitle className="text-base">Settings</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-1 overflow-hidden">
                            {/* Sidebar */}
                            <div className="w-40 border-r border-border p-3 flex-shrink-0">
                                <p className="px-2 py-1.5 text-sm font-medium bg-accent rounded-md">Appearance</p>
                            </div>
                            {/* Content */}
                            <div className="flex-1 p-6 overflow-y-auto">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Theme</label>
                                        <Select value={theme} onValueChange={handleThemeChange}>
                                            <SelectTrigger className="w-48">
                                                <SelectValue placeholder="Theme" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="light">
                                                    <div className="flex items-center gap-2">
                                                        <Sun className="h-4 w-4" />
                                                        <span>Light</span>
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="dark">
                                                    <div className="flex items-center gap-2">
                                                        <Moon className="h-4 w-4" />
                                                        <span>Dark</span>
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="system">
                                                    <div className="flex items-center gap-2">
                                                        <Monitor className="h-4 w-4" />
                                                        <span>System</span>
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Account */}
                {isLoaded && (
                    collapsed ? (
                        isSignedIn ? (
                            <div className="flex justify-center py-1">
                                <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8' } }} />
                            </div>
                        ) : (
                            <SignInButton mode="modal">
                                <Button variant="ghost" size="icon" className="w-full h-9" aria-label="Sign in">
                                    <User className="h-4 w-4" />
                                </Button>
                            </SignInButton>
                        )
                    ) : (
                        isSignedIn ? (
                            <div className="flex items-center gap-2 px-2 py-1">
                                <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8' } }} />
                                <span className="text-sm text-muted-foreground truncate">Account</span>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                <SignUpButton mode="modal">
                                    <Button size="sm" className="w-full rounded-full font-semibold text-xs">
                                        Sign up free
                                    </Button>
                                </SignUpButton>
                                <SignInButton mode="modal">
                                    <Button variant="ghost" size="sm" className="w-full text-xs">
                                        Sign in
                                    </Button>
                                </SignInButton>
                            </div>
                        )
                    )
                )}
            </div>
        </aside>
    );
}

export default AppSidebar;
