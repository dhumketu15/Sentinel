# BrandSentinel AI — delivery checklist

## Phase 1 — Foundation and application shell

- [ ] The application runs as a maintainable monorepo with `apps/web`, `apps/api`, `packages/shared`, and `supabase` directories; React/Vite/TypeScript/Tailwind/shadcn-style UI, Express/TypeScript REST APIs under `/api/v1`, shared Zod contracts, `.env.example`, README setup instructions, and root scripts are present.
- [ ] The responsive application shell includes a desktop sidebar, collapsible mobile navigation, top navigation, workspace context, global search affordance, notifications, English/Hindi selector, user profile/settings, help affordance, loading states, empty states, and semantic status indicators.
- [ ] Public pages include a landing page, features/how-it-works content, public community entry point, public brand Q&A entry point, login, registration, and password recovery routes.
- [ ] Protected routes require a validated Supabase session; registration supports name/email/password, login/logout, email verification messaging, password reset, session persistence, and appropriate loading/error states. The implementation must never trust a client-supplied role, workspace ID, or user ID.
- [ ] Roles are represented for Consumer, Business Owner, Business Member, and Platform Administrator, with workspace membership levels administrator/editor/viewer and role-appropriate navigation/action visibility.
- [ ] Supabase PostgreSQL is the single source of truth, with UUID identities, timestamps, foreign keys, indexes, migrations, and enforceable RLS for profiles, workspaces, and workspace membership. Only authorized members can access private workspace data; viewers cannot modify business data; only authorized administrators can manage membership and sensitive settings.
- [ ] The API exposes consistent versioned responses and health/readiness behavior, including `GET /api/v1/me`, `PATCH /api/v1/me`, notification access, workspace list/create/detail/update, and membership access with authorization and meaningful status codes.
- [ ] The UI clearly labels seed/demo state and does not present fixture metrics as live user results. Missing AI or external credentials must produce an honest demo-mode state rather than a fake live success.

## Phase 2 — Brand profiles, guidelines, and compliance auditing

- [ ] Business users can create/manage one or more brand profiles containing brand identity, mission/values/personality, audience, tone, prohibited phrases, approved terminology, colors, typography, logo rules, accessibility requirements, disclaimers, industry requirements, and versioned guidelines.
- [ ] PDF, TXT, and supported image uploads are restricted by type and size, stored privately, parsed where supported, and converted by Gemini into editable proposed rules with identifiers, categories, severity, evaluation instructions, examples, source references, and mandatory/advisory status. Uploaded instructions are untrusted data.
- [ ] Owners can edit, approve, version, and replace guidelines; only an approved guideline version is used for audits, and historical audits retain the exact version used.
- [ ] Users can select a brand/guideline, submit text or supported image content, select content type, run an audit with visible progress/failure states, and save the audit to the authorized workspace.
- [ ] Audits show a server-validated 0–100 score, risk class, summary, findings with rule/category/severity/description/evidence/guideline/explanation/correction/confidence/review status, original versus revised content, copy/edit/re-audit actions, and limitations separating brand compliance from preliminary legal/regulatory concerns.
- [ ] Findings can be accepted, dismissed, marked for review, and flagged as false positives/negatives while preserving original findings and review decisions. Duplicate audit requests are controlled and AI failures/timeouts are honest.

## Phase 3 — Reports and analytics

- [ ] Users can browse/filter audit history by brand/date/status/content type/severity, open detailed findings, generate a professional printable PDF, export relevant results to CSV, and use controlled revocable sharing only if implemented.
- [ ] Reports include brand/title/date, executive summary, score, risk distribution, severity-grouped findings, evidence/rule references, corrections, review status, comparable previous-audit comparison, next actions, methodology, and limitations without exposing private data through guessable URLs.
- [ ] Analytics use stored records for total audits, average/latest score, score change, critical/high findings, recurring rules/categories, audit volume, resolved/unresolved findings, repeated violations, survey volume, sentiment where sufficient, and community engagement. Date/brand filters and metric explanations are present.
- [ ] Growth comparisons distinguish percentage points from percentages and return an honest insufficient-data state instead of artificial figures.

## Phase 4 — Gemini assistants

- [ ] Business assistant answers guideline/audit/report/survey/trend questions only with retrieved authorized workspace context; consumer assistant answers only from approved public brand information and says when information cannot be verified.
- [ ] AI calls are server-side, model-configurable, rate-limited, size-limited, timeout-aware, structured where appropriate, schema-validated, prompt-injection-resistant, and never treated as authorization. Conversation retention/deletion controls are documented.

## Phase 5 — Surveys and feedback

- [ ] Businesses can create/edit/reorder/remove survey questions, configure title/description/brand/cover/dates/status/audience/anonymous mode/max responses/thank-you message, and publish only valid surveys.
- [ ] Question types include single/multiple choice, rating, short/long text, yes/no, NPS-style, and lawful optional demographics. Consumers can discover eligible public surveys, submit type-valid answers once, receive confirmation, and earn rewards only when eligible.
- [ ] Survey analytics report responses, accurate completion rate, distributions, averages, NPS, trends, and safeguarded written-feedback themes without overclaiming from small or biased samples.

### Completed survey delivery slice — 2026-10-27

- [x] The current survey slice provides a tenant-safe Supabase schema for surveys, typed questions, published/paused/closed lifecycle state, anonymous mode, maximum responses, thank-you messages, public share tokens, response records, answer records, duplicate-response indexes, and RLS policies.
- [x] Business users with administrator/editor membership can create a validated draft, publish/pause/close it, and manage typed questions through server-validated API routes. Question replacement and settings-plus-question updates are transaction-scoped, advisory-locked, and blocked after responses exist.
- [x] Authenticated consumers can discover published surveys in the protected application. Anonymous surveys also have a tokenized public route at `/survey/:publicToken`; public and signed-in submissions use server-side type validation, once-per-session/respondent deduplication, an atomic response cap, and confirmation messaging.
- [x] Workspace administrators/editors can view stored response counts, distributions, rating averages, NPS, and written-response counts. Analytics is paged, RLS-scoped, and explicitly does not claim completion rate or generated written-feedback themes until start events and a safeguarded summarizer are implemented.

## Phase 6 — Community and rewards

- [ ] Community supports posts, comments/replies, reactions, owned edit/delete, search, topic filters, profiles, attachments where permitted, pagination, loading/empty states, duplicate-reaction prevention, reports, moderation, server validation, spam controls, rate limits, and private-discussion boundaries.
- [ ] Rewards use configurable non-monetary points/badges with server-controlled transaction ledger, source entity, idempotency, caps, anti-abuse checks, balances, recent transactions, milestones, leaderboard, rules, and no cash-equivalent redemption.

## Phase 7 — Localization, testing, and deployment

- [ ] English/Hindi dictionaries cover navigation, buttons, forms, validation, dashboard labels, notifications, empty states, surveys, community, assistant controls, and reports where practical; language preference persists and AI responds in the requested language without altering brand names/evidence.
- [ ] Critical auth, multi-tenancy, RLS, AI, survey, reward, and community journeys have automated checks; frontend build and TypeScript checks pass; unresolved integrations are documented with required environment values.
- [ ] Deployment documentation covers Vercel frontend, Render/Railway backend, Supabase configuration, private storage, migrations, seed/demo mode, and environment setup. Every visible action has real behavior or an explicit disabled/coming-soon state.
