# AGENTS.md

## Project
Mobile-first web app to organize secret birthday gift coordination in groups.

## Stack
React + Vite + JavaScript
Supabase (Auth, Postgres, Storage, Realtime, RLS)
Vercel

## Core product rules
- The birthday user must never see hidden event data.
- No in-app payment processing.
- Support multiple expenses per event.
- Optimize for mobile first.
- Keep components small and reusable.
- Use feature-based folder structure.

## Commands
- npm install
- npm run dev
- npm run build

## Engineering conventions
- Prefer simple components and hooks.
- Keep server state separated from UI state.
- Avoid premature abstraction.
- Keep forms explicit and readable.
- Add comments only when logic is not obvious.

## Done means
- Code runs locally.
- No broken routes.
- No unused imports.
- Any new data access respects RLS assumptions.
- Any new feature includes empty/loading/error states.