create type public.guideline_status as enum ('draft', 'pending_review', 'approved', 'archived');
create type public.audit_status as enum ('queued', 'processing', 'completed', 'failed');
create type public.finding_severity as enum ('critical', 'high', 'medium', 'low', 'informational');
create type public.finding_review_status as enum ('pending', 'accepted', 'dismissed', 'requires_review');

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  description text,
  industry text,
  website text,
  mission text,
  values text[] not null default '{}',
  personality text,
  target_audience text,
  preferred_tone text,
  prohibited_phrases text[] not null default '{}',
  approved_terminology text[] not null default '{}',
  colors jsonb not null default '{}'::jsonb,
  typography text,
  logo_usage_rules text,
  accessibility_requirements text,
  required_disclaimers text,
  industry_compliance text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brand_guideline_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status public.guideline_status not null default 'draft',
  title text not null,
  source_document_name text,
  source_text text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, version_number)
);

create table public.brand_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  guideline_version_id uuid not null references public.brand_guideline_versions(id) on delete cascade,
  rule_key text not null,
  title text not null,
  description text not null,
  category text not null,
  severity public.finding_severity not null default 'medium',
  evaluation_instructions text not null,
  compliant_examples text[] not null default '{}',
  noncompliant_examples text[] not null default '{}',
  source_reference text,
  mandatory boolean not null default false,
  created_at timestamptz not null default now(),
  unique (guideline_version_id, rule_key)
);

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  guideline_version_id uuid not null references public.brand_guideline_versions(id) on delete restrict,
  content_type text not null,
  content_text text not null,
  status public.audit_status not null default 'queued',
  overall_score numeric(5,2) check (overall_score between 0 and 100),
  risk_class text,
  summary text,
  model_id text,
  prompt_version text,
  is_demo boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  rule_id uuid references public.brand_rules(id) on delete set null,
  category text not null,
  severity public.finding_severity not null,
  description text not null,
  evidence text,
  guideline_reference text,
  explanation text not null,
  recommended_correction text,
  confidence numeric(4,3) check (confidence between 0 and 1),
  review_status public.finding_review_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.audit_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  finding_id uuid not null references public.audit_findings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  decision public.finding_review_status not null,
  note text,
  created_at timestamptz not null default now()
);

create index brands_workspace_id_idx on public.brands(workspace_id);
create index guidelines_workspace_brand_idx on public.brand_guideline_versions(workspace_id, brand_id, version_number desc);
create index rules_guideline_version_idx on public.brand_rules(guideline_version_id);
create index audits_workspace_created_at_idx on public.audits(workspace_id, created_at desc);
create index findings_audit_id_idx on public.audit_findings(audit_id);
create index reviews_finding_id_idx on public.audit_reviews(finding_id, created_at desc);

create trigger brands_set_updated_at before update on public.brands for each row execute function public.set_updated_at();
create trigger guidelines_set_updated_at before update on public.brand_guideline_versions for each row execute function public.set_updated_at();

alter table public.brands enable row level security;
alter table public.brand_guideline_versions enable row level security;
alter table public.brand_rules enable row level security;
alter table public.audits enable row level security;
alter table public.audit_findings enable row level security;
alter table public.audit_reviews enable row level security;

create policy brands_select_member on public.brands for select using (private.is_workspace_member(workspace_id));
create policy brands_insert_editor on public.brands for insert with check (created_by = auth.uid() and private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[]));
create policy brands_update_editor on public.brands for update using (private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[])) with check (private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[]));
create policy brands_delete_admin on public.brands for delete using (private.has_workspace_role(workspace_id, array['administrator']::public.workspace_member_role[]));

create policy guidelines_select_member on public.brand_guideline_versions for select using (private.is_workspace_member(workspace_id));
create policy guidelines_insert_editor on public.brand_guideline_versions for insert with check (created_by = auth.uid() and private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[]));
create policy guidelines_update_editor on public.brand_guideline_versions for update using (private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[])) with check (private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[]));

create policy rules_select_member on public.brand_rules for select using (private.is_workspace_member(workspace_id));
create policy rules_insert_editor on public.brand_rules for insert with check (private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[]));
create policy rules_update_editor on public.brand_rules for update using (private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[])) with check (private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[]));
create policy rules_delete_editor on public.brand_rules for delete using (private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[]));

create policy audits_select_member on public.audits for select using (private.is_workspace_member(workspace_id));
create policy audits_insert_editor on public.audits for insert with check (created_by = auth.uid() and private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[]));
create policy audits_update_editor on public.audits for update using (private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[])) with check (private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[]));

create policy findings_select_member on public.audit_findings for select using (private.is_workspace_member(workspace_id));
create policy findings_insert_editor on public.audit_findings for insert with check (private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[]));
create policy findings_update_editor on public.audit_findings for update using (private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[])) with check (private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[]));

create policy reviews_select_member on public.audit_reviews for select using (private.is_workspace_member(workspace_id));
create policy reviews_insert_editor on public.audit_reviews for insert with check (user_id = auth.uid() and private.has_workspace_role(workspace_id, array['administrator','editor']::public.workspace_member_role[]));
