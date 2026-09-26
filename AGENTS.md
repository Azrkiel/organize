# AGENTS.md: Organize

Read this file at the start of every session. The full build plan is in `PLAN.md`.

## What this is
**Organize** is a personal, minimalist study app for ONE user (the owner). Everything is organized around **courses** (e.g. Chem, Calc). Each course has nested folders of notes, tasks, calendar events, flashcards, focus sessions, and recorded lectures. Lectures are transcribed and turned into notes, with slide photos taken on the owner's iPhone added as context. A course syllabus can be imported to build a topic map, and the app generates exam study guides and practice questions. Deadlines sync to Google Calendar and/or Outlook so the owner gets reminders there, and notes can be exported to OneNote and NotebookLM.

Design priorities, in order: **fast, simple, calm**. No feature creep. If something isn't in PLAN.md, ask before building it.

## Cost rule: this app must run for $0
- Only use services on their **free tier**: Vercel Hobby, Supabase Free, Google Calendar API, Microsoft Graph, Resend Free, Gemini API free tier.
- **Never** add a paid service, paid API, or a dependency that requires a credit card without asking first.
- Prefer on-device processing (browser speech recognition, in-browser Whisper) over paid cloud APIs.
- Protect the Supabase free storage limit (~1 GB): **never store lecture audio in Supabase**, and compress every photo in the browser before upload (max 1600px long edge, JPEG ~0.7 quality). Audio lives in the browser (IndexedDB) until it's transcribed, then it is deleted (the user can download it first).
- Design for Supabase free-tier behavior: projects pause after ~1 week of inactivity. Show a friendly error if the database is unreachable instead of crashing.

## Stack (do not swap without asking)
- Next.js 15 (App Router) + TypeScript (strict) + Tailwind CSS + shadcn/ui
- Supabase: Postgres, Auth, Storage (via `@supabase/ssr`), migrations in `supabase/migrations/`
- TipTap editor + `@tiptap/extension-mathematics` (KaTeX) + KaTeX mhchem for chemistry
- `googleapis` for Google Calendar; Microsoft Graph via plain `fetch` for Outlook and OneNote
- Lecture transcription: browser Web Speech API (live) + Whisper running in the browser via `@huggingface/transformers` (accurate, after class)
- Transcript → notes: Gemini API free tier via `@google/genai`, behind a provider interface so it can be swapped later
- iPhone slide capture: the installed PWA (camera via `<input capture>`), NOT a native iOS app. Photos upload to Supabase Storage and appear on the laptop in real time via Supabase Realtime
- Slide text: Gemini vision when a key is set; tesseract.js (free, in-browser OCR) as the fallback
- PDFs: pdfjs-dist to read syllabus text in the browser; jspdf to build PDFs (slide packs, printable study guides) in the browser
- Resend (free tier) for the daily digest email; Vercel Cron to trigger it
- Hosting: Vercel on the free `*.vercel.app` domain. PWA via `app/manifest.ts` + a minimal service worker
- Tests: Vitest for pure logic

## How to work
1. Work on **one phase of PLAN.md at a time**. Never start the next phase unless told to.
2. At the start of a phase, restate the tasks as a checklist; at the end, check them off in PLAN.md.
3. Before declaring a phase done, run **all** of these and fix any failures:
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run test` (once Vitest exists)
   - `npm run build`
4. Commit at the end of each phase: `git commit -m "Phase N: <summary>"`.
5. When a step needs the human (creating accounts, pasting secrets, clicking in a dashboard), **stop**, list exactly what they must do, and wait.
6. Prefer small, readable files. Server-only code goes in `lib/server/` and must never be imported by client components.
7. When using an external API or library version you're unsure about (Gemini model names, transformers.js model IDs, Graph endpoints), check the current docs rather than guessing.

## Conventions
- Database: snake_case. TypeScript: camelCase. Generate DB types with `npx supabase gen types typescript --linked > lib/database.types.ts` after every migration.
- Every table has `user_id uuid references auth.users` and Row Level Security with `user_id = auth.uid()`.
- Data mutations use Server Actions or route handlers. Validate all input with `zod`.
- Timestamps are `timestamptz`; display in the browser's local time zone.
- UI: neutral palette, one accent color per course, generous whitespace, keyboard-friendly. Must work at 375px wide (phone).

## Security and privacy rules (non-negotiable)
- Never commit `.env.local` or any secret. Keep `.env.example` updated with variable NAMES only.
- `SUPABASE_SERVICE_ROLE_KEY`, OAuth client secrets, API keys, and refresh tokens are server-only.
- OAuth refresh tokens are stored encrypted (AES-256-GCM with `TOKEN_ENCRYPTION_KEY`).
- Cron endpoints require `Authorization: Bearer ${CRON_SECRET}`.
- Before the first lecture recording, show a one-time reminder that the user is responsible for following their school's and professors' recording policies.

## Commands
- `npm run dev`: local dev server
- `npx supabase db push`: apply migrations to the linked project
- `npm run test`: Vitest
