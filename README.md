# BrandSentinel AI

BrandSentinel AI is a bilingual brand-protection workspace for turning brand rules into evidence-led content decisions. The interface follows the supplied BrandSentinel reference skeleton while the product surface is organized as an operational SaaS shell for business owners, members, consumers, and moderators.

## Current phase

Phase 1 establishes the React/Vite frontend, Express API foundation, Supabase client boundaries, bilingual navigation, protected-route structure, and the initial workspace/membership schema with RLS. Pages marked **Demo data** are deterministic fixtures and are not presented as live user results.

## Repository structure

- `apps/web` — React + Vite + TypeScript + Tailwind client.
- `apps/api` — Express + TypeScript REST API under `/api/v1`.
- `packages/shared` — shared Zod contracts and domain constants.
- `supabase` — migrations and seed scripts for the Supabase PostgreSQL project.

## Local development

1. Copy `.env.example` to `.env` and set the Supabase URL and publishable/anon key. Keep service-role and Gemini keys server-only.
2. Install dependencies with `pnpm install`.
3. Run `pnpm dev` to start the web app on port 3000 and the API on port 3001.
4. Run `pnpm typecheck` and `pnpm build` before committing a feature.

When the browser-safe Supabase values are absent, the UI stays available in clearly labelled demo mode and authentication calls fail honestly rather than fabricating a session.

## Supabase

The intended project is the existing `BrandSentinel` Supabase project. Apply migrations from `supabase/migrations` through the Supabase CLI or the Supabase MCP migration workflow. The database is the source of truth; no MongoDB layer is used. RLS policies are part of the migration and must remain enabled in production.

## Deployment

The frontend is designed for Vercel and the API for Render or Railway. Configure the variables in `.env.example` in each deployment environment. Never expose `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` through a `VITE_` variable or browser bundle. Gemini-dependent flows will use an explicit deterministic demo mode until `GEMINI_API_KEY` is configured.
