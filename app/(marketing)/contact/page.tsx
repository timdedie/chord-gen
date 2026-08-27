import React from 'react';
import Link from 'next/link';
import Script from 'next/script';
import type { Metadata } from 'next';
import { MessageSquare, Bug, Sparkles } from 'lucide-react';
import CopyEmail from './CopyEmail';

const email = 'contact@chordgen.org';
const url = 'https://www.chordgen.org/contact';

export const metadata: Metadata = {
    title: 'Contact ChordGen',
    description:
        'Get in touch with the ChordGen team. Report a bug, suggest a feature, ask about commercial use, or just say hi.',
    alternates: { canonical: '/contact' },
    openGraph: {
        title: 'Contact ChordGen',
        description: 'Get in touch with the ChordGen team.',
        url,
        type: 'website',
    },
};

const reasons = [
    {
        Icon: Bug,
        title: 'Report a bug',
        body: 'Found something broken? Send a short description and the prompt you used. We read every report.',
    },
    {
        Icon: Sparkles,
        title: 'Suggest a feature',
        body: 'Missing an instrument, an export format, a workflow? Tell us what would make ChordGen more useful.',
    },
    {
        Icon: MessageSquare,
        title: 'Press, partnerships, or licensing',
        body: 'Working on something we should know about? We respond to legitimate inquiries within a few days.',
    },
];

const contactSchema = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Contact ChordGen',
    url,
    mainEntity: {
        '@type': 'Organization',
        name: 'ChordGen',
        email,
        url: 'https://www.chordgen.org',
        contactPoint: {
            '@type': 'ContactPoint',
            email,
            contactType: 'customer support',
            availableLanguage: 'English',
        },
    },
};

const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.chordgen.org' },
        { '@type': 'ListItem', position: 2, name: 'Contact', item: url },
    ],
};

export default function ContactPage() {
    return (
        <div className="bg-gray-50 dark:bg-black">
            <section className="px-4 pt-20 pb-12">
                <div className="max-w-3xl mx-auto">
                    <nav className="text-sm text-gray-500 dark:text-gray-500 mb-6" aria-label="Breadcrumb">
                        <Link href="/" className="hover:text-primary">Home</Link>
                        <span className="mx-2">/</span>
                        <span>Contact</span>
                    </nav>

                    <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-gray-900 dark:text-white mb-6">
                        Get in touch
                    </h1>
                    <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
                        Bug reports, feature requests, partnerships, or just a hello. We read every email.
                    </p>
                </div>
            </section>

            <section className="px-4 pb-20">
                <div className="max-w-3xl mx-auto">
                    <CopyEmail email={email} />

                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">
                        What can we help with?
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-16">
                        {reasons.map((r) => (
                            <div
                                key={r.title}
                                className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                            >
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <r.Icon className="h-5 w-5 text-primary" />
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                                    {r.title}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                    {r.body}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-800 pt-10">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                            Looking for something else?
                        </h2>
                        <ul className="space-y-2 text-base">
                            <li>
                                <Link href="/app" className="text-primary hover:underline">
                                    → Open the chord generator
                                </Link>
                            </li>
                            <li>
                                <Link href="/chordchord-alternative" className="text-primary hover:underline">
                                    → ChordGen vs. ChordChord
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            <Script
                id="contact-schema"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }}
            />
            <Script
                id="contact-breadcrumb-schema"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />
        </div>
    );
}
