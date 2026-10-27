# BrandSentinel AI — implementation plan

## Product scope

BrandSentinel AI is a bilingual (English/Hindi) brand-protection SaaS MVP. The build will prioritize a reliable business-owner workflow: create a workspace, define a brand, approve versioned guidelines, audit marketing content with validated AI findings, review corrections, generate reports, and understand trends. Consumer Q&A, surveys, community, and non-monetary rewards will be delivered as connected vertical slices after the core audit/reporting foundation.

The supplied `BrandSentinelAI.html` is the visual reference for the product's confident brand-protection voice, structured audit preview, strong accent treatment, themeable dark surfaces, and responsive interactions. Its public landing-page language will be translated into the authenticated product shell rather than copied as a static page.

## Architecture and implementation approach

- **Monorepo:** `apps/web` contains the Vite React client; `apps/api` contains the Express REST API; `packages/shared` contains shared Zod schemas, domain constants, and types; `supabase` contains SQL migrations and seed scripts.
- **Frontend:** React + TypeScript + Tailwind CSS, reusable shadcn/ui-style primitives, React Router, TanStack Query, React Hook Form, Zod, Recharts, Lucide React, and i18next-compatible translation dictionaries. The shell is route-driven and role-aware, with a public marketing surface and protected workspace pages.
- **Backend:** Express + TypeScript under `/api/v1`, request validation at route boundaries, authentication middleware that validates Supabase access tokens, workspace membership authorization, structured errors, health/readiness endpoints, and a service layer for AI/reporting workflows.
- **Supabase:** Supabase Auth owns user identity and sessions, PostgreSQL is the application source of truth, Storage is private for business assets, and RLS is the database boundary for profiles/workspaces/memberships and later tenant-owned records. The existing `BrandSentinel` Supabase project (`scdatiybqnhplktrbnwn`) is the intended target; no new project is created.
- **AI:** Gemini integration stays in `apps/api/src/services`, with schema-validated structured output, configurable model and prompt version, request limits, timeouts, prompt-injection boundaries, deterministic demo fixtures when credentials are absent, and server-calculated scoring.
- **Delivery:** Run the local preview on port 3000, expose a route manifest, maintain `.env.example` and README setup/deployment instructions, checkpoint every independently delivered feature, and push to the confirmed GitHub repository after each feature when the repository is safe to use.

## Phase sequence

1. **Foundation:** Monorepo/toolchain, application shell, bilingual navigation, public/auth routes, protected-route boundary, Supabase client/server adapters, initial profile/workspace/membership schema and RLS, API health/me/workspace endpoints, demo-state labels, and responsive navigation.
2. **Core auditing:** Brand profiles, guideline upload and structured policy extraction, review/approval/versioning, audit creation/processing/results, validated finding schemas, scoring, review actions, and audit history.
3. **Reports and analytics:** PDF/CSV export, historical filtering, score trends, severity/category breakdowns, comparable-period calculations, and honest insufficient-data states.
4. **AI assistants:** Workspace-scoped business assistant and public-information-only consumer assistant with rate limits, context boundaries, bilingual responses, and deletion/retention controls.
5. **Surveys and feedback:** Survey editor, publication lifecycle, response validation/duplicate prevention, analytics, and safeguarded written-feedback insights.
6. **Community and rewards:** Posts/comments/replies/reactions/search/filtering, abuse reports/moderation, configurable reward ledger, badges, milestones, leaderboard, idempotency, and anti-abuse checks.
7. **Localization and polish:** Complete English/Hindi coverage, accessibility, responsive refinement, loading/error/empty/success states, and visual consistency review.
8. **Testing and deployment:** Critical journey tests, tenant-isolation checks, API/build/type checks, deployment configuration, and explicit live-versus-demo integration documentation.

## Design direction

### Design movement

**Editorial control room:** a restrained enterprise command center that combines a dark navy canvas, violet signal color, and crisp document-like panels so brand teams can move from evidence to action without visual noise.

### Core principles

1. **Evidence before decoration:** metrics, findings, and sources are visually prioritized over ornamental cards.
2. **Calm authority:** high-contrast navy and white provide trust; violet marks actions and active state; amber/red/green remain semantic only.
3. **Progressive disclosure:** overview surfaces stay scannable while detailed audits, rules, and report evidence open into focused panels.
4. **Honest intelligence:** demo mode, uncertainty, risk class, and limitations are visible rather than hidden behind optimistic copy.

### Color philosophy

Deep navy is the stable workspace surface; white and cool slate create legibility for dense operational content; electric violet is the ownable decision signal for action, active navigation, and AI-assisted moments. Amber, red, and green are reserved for severity and state so the interface never confuses emphasis with risk.

### Layout paradigm

Use a persistent left rail and an offset content canvas: the navigation is a stable vertical index while each page begins with a clear page header, one primary action, and a small number of evidence-led modules. Avoid an undifferentiated dashboard grid by varying wide trend panels, compact metric strips, and full-width data tables.

### Signature elements

- A shield-check wordmark and violet “signal” line that anchors the brand-protection concept.
- Evidence cards with thin borders, small uppercase labels, and severity pills that resemble review annotations.
- A “demo data” treatment that is quiet but persistent wherever seeded fixtures or offline AI results appear.

### Interaction and animation

Interactions should feel deliberate: 160–220ms color/border transitions, subtle 1–2px lift on primary cards, and no continuous motion. Loading uses skeleton bars and status steps; score rings and chart lines animate once when they enter view, with reduced-motion fallbacks. Destructive or irreversible actions use confirmation dialogs; async work always exposes pending and failure states.

### Typography system

Use Sora for display/brand headings and Inter for body, controls, tables, and evidence. Headings are compact and slightly tracked down; body copy is 14–16px with comfortable line height; labels use 11–12px uppercase slate text. Hindi strings must inherit a Unicode-safe system fallback and never be forced into Latin-only metrics.

### Brand essence and voice

**BrandSentinel AI is the evidence-led control room for teams that cannot afford brand drift.** Personality: vigilant, clear, pragmatic.

Headlines are direct and operational. CTAs describe the next action rather than making vague promises. Example lines: “Turn brand rules into decisions.” and “Review the evidence before you publish.”

### Wordmark and signature color

The wordmark is a compact shield split by a verification stroke, paired with the name in Sora. The signature color is **Signal Violet `#8B5CF6`**, used sparingly for action and trusted AI assistance.

## Project structure

```text
apps/web/
  public/manus-routes.json
  src/components/ui/        reusable UI primitives
  src/components/            app-specific navigation and status components
  src/features/auth/         Supabase auth context and forms
  src/layouts/               public and protected application shells
  src/pages/                 route-level pages
  src/lib/                   Supabase client, API client, utilities
  src/i18n/                  English and Hindi dictionaries
  src/types/                 frontend domain types
apps/api/
  src/config/                environment and runtime configuration
  src/controllers/           request handlers
  src/lib/                   Supabase server client and logging
  src/middleware/            auth, validation, errors, rate limits
  src/routes/                versioned REST route composition
  src/schemas/               request/response validation
  src/services/              audit, guideline, assistant, report services
packages/shared/src/          shared schemas/constants/types
supabase/migrations/          additive PostgreSQL schema and RLS policies
```
