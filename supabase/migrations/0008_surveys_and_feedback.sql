create type public.survey_status as enum ('draft', 'published', 'paused', 'closed');
create type public.survey_question_type as enum ('single_choice', 'multiple_choice', 'rating', 'short_text', 'long_text', 'yes_no', 'nps', 'demographic');
create type public.survey_response_status as enum ('in_progress', 'submitted');

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 160),
  description text,
  cover_image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.survey_status not null default 'draft',
  audience text not null default 'public' check (char_length(audience) between 2 and 80),
  anonymous boolean not null default false,
  max_responses integer check (max_responses is null or max_responses between 1 and 1000000),
  thank_you_message text not null default 'Thank you for sharing your feedback.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null,
  workspace_id uuid not null,
  question_type public.survey_question_type not null,
  prompt text not null check (char_length(prompt) between 3 and 1000),
  options jsonb not null default '[]'::jsonb,
  position integer not null check (position >= 0),
  required boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, survey_id, workspace_id),
  unique (survey_id, position),
  foreign key (survey_id, workspace_id) references public.surveys(id, workspace_id) on delete cascade
);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null,
  workspace_id uuid not null,
  respondent_id uuid references public.profiles(id) on delete set null,
  anonymous_session_key text,
  status public.survey_response_status not null default 'submitted',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, survey_id, workspace_id),
  foreign key (survey_id, workspace_id) references public.surveys(id, workspace_id) on delete cascade,
  check (respondent_id is not null or anonymous_session_key is not null)
);

create table public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null,
  survey_id uuid not null,
  question_id uuid not null,
  workspace_id uuid not null,
  answer jsonb not null,
  created_at timestamptz not null default now(),
  unique (response_id, question_id),
  foreign key (response_id, survey_id, workspace_id) references public.survey_responses(id, survey_id, workspace_id) on delete cascade,
  foreign key (question_id, survey_id, workspace_id) references public.survey_questions(id, survey_id, workspace_id) on delete cascade
);

create unique index survey_responses_respondent_uidx on public.survey_responses(survey_id, respondent_id) where respondent_id is not null;
create unique index survey_responses_anonymous_session_uidx on public.survey_responses(survey_id, anonymous_session_key) where anonymous_session_key is not null;
create index surveys_workspace_status_idx on public.surveys(workspace_id, status, created_at desc);
create index survey_questions_survey_position_idx on public.survey_questions(survey_id, position);
create index survey_responses_survey_status_idx on public.survey_responses(survey_id, status, created_at desc);
create index survey_answers_survey_question_idx on public.survey_answers(survey_id, question_id);

create trigger surveys_set_updated_at before update on public.surveys for each row execute function public.set_updated_at();
create trigger survey_questions_set_updated_at before update on public.survey_questions for each row execute function public.set_updated_at();

alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_answers enable row level security;

alter table public.surveys add constraint surveys_brand_workspace_fk foreign key (brand_id, workspace_id) references public.brands(id, workspace_id);

create policy surveys_select_member_or_published on public.surveys for select using (
  private.is_workspace_member(workspace_id)
  or (status = 'published' and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()))
);
create policy surveys_insert_editor on public.surveys for insert with check (private.has_workspace_role(workspace_id, array['administrator', 'editor']::public.workspace_member_role[]) and created_by = auth.uid());
create policy surveys_update_editor on public.surveys for update using (private.has_workspace_role(workspace_id, array['administrator', 'editor']::public.workspace_member_role[])) with check (private.has_workspace_role(workspace_id, array['administrator', 'editor']::public.workspace_member_role[]));
create policy surveys_delete_admin on public.surveys for delete using (private.has_workspace_role(workspace_id, array['administrator']::public.workspace_member_role[]));

create policy survey_questions_select_visible on public.survey_questions for select using (exists (select 1 from public.surveys s where s.id = survey_id and s.workspace_id = survey_questions.workspace_id and (private.is_workspace_member(s.workspace_id) or (s.status = 'published' and (s.starts_at is null or s.starts_at <= now()) and (s.ends_at is null or s.ends_at >= now())))));
create policy survey_questions_insert_editor on public.survey_questions for insert with check (private.has_workspace_role(workspace_id, array['administrator', 'editor']::public.workspace_member_role[]));
create policy survey_questions_update_editor on public.survey_questions for update using (private.has_workspace_role(workspace_id, array['administrator', 'editor']::public.workspace_member_role[])) with check (private.has_workspace_role(workspace_id, array['administrator', 'editor']::public.workspace_member_role[]));
create policy survey_questions_delete_editor on public.survey_questions for delete using (private.has_workspace_role(workspace_id, array['administrator', 'editor']::public.workspace_member_role[]));

create policy survey_responses_select_owner_or_member on public.survey_responses for select using (respondent_id = auth.uid() or private.has_workspace_role(workspace_id, array['administrator', 'editor']::public.workspace_member_role[]));
create policy survey_responses_insert_published on public.survey_responses for insert with check (
  (respondent_id = auth.uid() or respondent_id is null)
  and exists (select 1 from public.surveys s where s.id = survey_id and s.workspace_id = survey_responses.workspace_id and s.status = 'published' and (s.starts_at is null or s.starts_at <= now()) and (s.ends_at is null or s.ends_at >= now()))
);
create policy survey_responses_update_owner on public.survey_responses for update using (respondent_id = auth.uid()) with check (respondent_id = auth.uid());

create policy survey_answers_select_owner_or_member on public.survey_answers for select using (
  private.has_workspace_role(workspace_id, array['administrator', 'editor']::public.workspace_member_role[])
  or exists (select 1 from public.survey_responses r where r.id = response_id and r.respondent_id = auth.uid())
);
create policy survey_answers_insert_owner_or_member on public.survey_answers for insert with check (
  private.has_workspace_role(workspace_id, array['administrator', 'editor']::public.workspace_member_role[])
  or exists (select 1 from public.survey_responses r where r.id = response_id and r.respondent_id = auth.uid())
);
