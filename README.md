# ChordGen

AI chord progression generator. Describe a mood, genre or vibe, get three progressions back, play them on a piano, edit and reorder the chords, export as MIDI.

Live at **[chordgen.org](https://www.chordgen.org)**.

Every generated chord is validated against [tonal.js](https://github.com/tonaljs/tonal) before it reaches you, and the generation endpoints retry when the model returns something that isn't a real chord.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind, shadcn/ui. Vercel AI SDK with DeepSeek Chat. Tone.js for audio, midi-writer-js for export, Clerk for auth, Neon Postgres via Drizzle.

## Running it locally

```bash
pnpm install
cp .env.example .env.local   # then fill it in
pnpm dev
```

You need a DeepSeek key, Clerk keys and a Postgres URL to get it booting. `.env.example` explains what each one is for and where to get it. Everything else is optional.

```bash
pnpm build    # production build
pnpm lint     # eslint
pnpm test     # node test runner
pnpm db:push  # push drizzle schema
```

## Contributing

PRs are welcome. Fair warning that I run this on the side, so reviews can take a while. If you're planning something big, open an issue first so we can talk it through before you spend real time on it.

Bug reports are always useful, especially with the prompt that caused the problem.

## License

MIT, see [LICENSE](LICENSE).
