import { MetadataRoute } from 'next';

// Use a stable date so Google does not see every URL as "modified" on every crawl.
// Bump this when you ship meaningful content updates.
const lastModified = new Date('2026-04-24');

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://www.chordgen.org';

    return [
        { url: baseUrl, lastModified, changeFrequency: 'monthly', priority: 1.0 },
        // /app is intentionally absent: it is noindexed in favour of "/", which
        // is now the canonical generator entry point.
        { url: `${baseUrl}/chordchord-alternative`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
        { url: `${baseUrl}/contact`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
    ];
}
