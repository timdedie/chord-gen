# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
pnpm dev          # Start dev server with Turbopack
pnpm build        # Production build
pnpm lint         # Run ESLint
```

## Architecture

**Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui

**AI Integration**: Vercel AI SDK with DeepSeek Chat (OpenAI-compatible API). Chord validation uses tonal.js `Chord.get()` to verify musical validity. Generation endpoints implement retry logic (up to 2 retries) when validation fails.

### Route Structure

- `app/(marketing)/` - Landing page (route group)
- `app/app/` - Main application interface
- `app/app/results/` - Chord progression display/editing
- `app/api/generate/` - Single chord/progression generation
- `app/api/generate-multiple/` - Generates 3 progression variations with style labels
- `app/api/explain-progression/` - Progression analysis

### Key Components

- `ProgressionCard.tsx` - Main progression display with editing, playback, drag-and-drop
- `PianoKeyboard.tsx` + `PianoProvider.tsx` - Interactive piano with Tone.js audio
- `useChordManagement.ts` - Hook managing chord generation, editing, and state
- `lib/schemas.ts` - Zod schemas for AI response validation

### Data Flow

1. User enters prompt on `/app` page
2. Navigates to `/app/results?q=prompt&n=numChords`
3. Results page calls `/api/generate-multiple`
4. API validates chords with tonal.js, retries on failure
5. Progressions displayed with interactive editing

### Audio/MIDI

- Tone.js for web audio playback
- react-piano for keyboard UI
- midi-writer-js for MIDI file export

## Environment Variables

Required in `.env.local`:
- `DEEPSEEK_API_KEY` - DeepSeek API key (primary LLM)
- `GOOGLE_GENERATIVE_AI_API_KEY` - Google GenAI (optional)

Optional (analytics — everything no-ops cleanly if unset):
- `NEXT_PUBLIC_POSTHOG_KEY` - PostHog project API key
- `NEXT_PUBLIC_POSTHOG_HOST` - PostHog host (defaults to `https://us.i.posthog.com`)

### Analytics (PostHog)

- Client init/identify lives in `components/providers/PostHogProvider.tsx` (mounted in `app/layout.tsx`). Uses `person_profiles: 'identified_only'`, manual SPA `$pageview` capture, and ties identity to Clerk (`identify` on sign-in with `role`, `reset` on sign-out).
- Client events go through the typed `capture()` helper + `AnalyticsEvent` catalog in `lib/analytics/events.ts`.
- Server events use `captureServer()` in `lib/analytics/posthog-server.ts` (direct `fetch` to PostHog — edge-runtime safe). `generate-multiple` fires `generation_succeeded` with model/role/premium context, keyed on the Clerk userId so it joins the same person as client events.

## Conventions

- Path alias: `@/*` maps to project root
- Dark mode via next-themes (class-based)
- Dynamic imports with `ssr: false` for audio components
- Client components explicitly marked with "use client"
