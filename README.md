# Türkçe — vocab + grammar flashcards   

https://turkishflashcards.vercel.app/  

A flashcard app for learning Turkish: plain vocab flashcards, plus a grammar-practice mode
that generates example sentences (via the free Gemini API) built around your own words and
the grammar concepts you want to drill. Wrong answers are tracked — missed words feed back
into your study queue, and missed grammar concepts build up accuracy stats you can review.

## One-time setup

1. **Install dependencies**

   ```sh
   npm install
   ```

2. **Create a free Supabase project** at [supabase.com](https://supabase.com).
   - In the SQL editor, run each migration in [`supabase/migrations/`](supabase/migrations/), in
     numeric order (`0001_init.sql`, `0002_concept_events.sql`, …).
   - In Project Settings → API, copy the **Project URL** and **anon public key**.
   - By default new users must confirm their email before signing in. For a personal app you
     can turn this off under Authentication → Providers → Email → "Confirm email" if you'd
     rather skip that step.

3. **Create a free Gemini API key** at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
   Keep this project free of billing to stay on the free tier.

4. **Copy `.env.example` to `.env`** and fill in the three values:

   ```
   GEMINI_API_KEY=
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```

## Running locally

```sh
vercel dev
```

Run this directly (not via an npm script — Vercel's CLI refuses to start if a `package.json`
script itself calls `vercel dev`, to guard against recursive invocation). It serves the
frontend and the `/api/generate-sentences` serverless function together (matching how it
behaves once deployed). The first run may prompt you to log in and link a Vercel
account/project — accept the defaults for local-only use, or run `vercel link` yourself first.

If you'd rather run just the frontend without the Vercel CLI (grammar-practice generation
won't work without it), use `npm run dev` instead (a plain Vite dev server).

## Deploying

```sh
vercel deploy
```

Set `GEMINI_API_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` as environment
variables in the Vercel project settings (Project → Settings → Environment Variables) so the
deployed app has them too.

## How it works

- **Words** tab: add/remove your Turkish word/meaning pairs.
- **Vocab study**: classic flip flashcards. Swipe or use the Right/Wrong buttons to grade each
  card. Wrong cards are flagged and can be isolated with the "Words I've gotten wrong" toggle.
- **Grammar practice**: pick grammar concepts to drill, choose how many sentences to generate,
  and whether Turkish or English shows first. Each generated sentence targets one of your
  words (highlighted) and demonstrates the concepts you picked. Click any word in the sentence
  to see its meaning; new words get an "Add to word list" option. Grading a sentence wrong asks
  whether the word, the grammar, or both were the problem — grammar misses build up per-concept
  accuracy stats shown at the bottom of the tab.

Data lives in Supabase (per-account, synced across devices you sign into). Grammar concepts
themselves are a static starter list for Turkish, defined in `src/data/grammarConcepts.ts`.

## Offline support

The app is an installable PWA (add it to your phone's home screen or your desktop browser's
app list) and **Vocab Study works with zero connectivity**, including a cold start with no
network at all:

- Your word list is mirrored to the device's local storage. It renders from that mirror
  instantly, then quietly reconciles with Supabase in the background when online.
- Adding a word, deleting a word, or grading a flashcard while offline is saved locally
  right away and queued up; the queue replays against Supabase automatically the next time
  the device is back online (no action needed, and safe to close the tab/app in the meantime).
- A small status pill appears in the header when you're offline or still syncing queued
  changes, and disappears once everything's caught up.

**Grammar Practice is online-only** — sentence generation is a live Gemini call, so there's
nothing to cache. If you try to generate sentences while offline, the "Generate sentences"
button is disabled and a short notice explains why; Vocab Study is unaffected.

Note for local testing: service workers don't meaningfully activate under the plain dev
server. To try offline behavior locally, use a production-style build (`npm run build` +
`npm run preview`) and then toggle "Offline" in your browser's DevTools (or real airplane
mode) — the deployed Vercel URL works the same way without any extra steps.
