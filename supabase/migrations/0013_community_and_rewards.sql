create type public.community_visibility as enum ('public', 'workspace');
create type public.community_post_status as enum ('published', 'hidden', 'removed');
create type public.community_comment_status as enum ('published', 'hidden', 'removed');
create type public.community_report_status as enum ('pending', 'resolved', 'dismissed');

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  body text not null check (char_length(body) between 1 and 10000),
  topic text not null default 'general' check (char_length(topic) between 2 and 60),
  visibility public.community_visibility not null default 'public',
  status public.community_post_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility = 'public' or workspace_id is not null)
);

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  parent_comment_id uuid references public.community_comments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  status public.community_comment_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('support', 'insightful', 'helpful')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  status public.community_report_status not null default 'pending',
  created_at timestamptz not null default now(),
  check ((post_id is not null) <> (comment_id is not null)
));

create unique index community_reports_post_once_uidx on public.community_reports(reporter_id, post_id) where post_id is not null;
create unique index community_reports_comment_once_uidx on public.community_reports(reporter_id, comment_id) where comment_id is not null;
create index community_posts_feed_idx on public.community_posts(status, visibility, created_at desc);
create index community_posts_workspace_idx on public.community_posts(workspace_id, status, created_at desc);
create index community_posts_topic_idx on public.community_posts(topic, created_at desc);
create index community_comments_post_idx on public.community_comments(post_id, status, created_at asc);
create index community_reports_status_idx on public.community_reports(status, created_at desc);

create trigger community_posts_set_updated_at before update on public.community_posts for each row execute function public.set_updated_at();
create trigger community_comments_set_updated_at before update on public.community_comments for each row execute function public.set_updated_at();

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_reports enable row level security;

create policy community_posts_select_visible on public.community_posts for select using (
  status = 'published' and (visibility = 'public' or private.is_workspace_member(workspace_id))
);
create policy community_posts_insert_own on public.community_posts for insert with check (
  author_id = auth.uid() and (visibility = 'public' or private.is_workspace_member(workspace_id))
);
create policy community_posts_update_own on public.community_posts for update using (author_id = auth.uid() and status <> 'removed') with check (author_id = auth.uid());
create policy community_posts_delete_own on public.community_posts for delete using (author_id = auth.uid());

create policy community_comments_select_visible on public.community_comments for select using (
  status = 'published' and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published' and (p.visibility = 'public' or private.is_workspace_member(p.workspace_id)))
);
create policy community_comments_insert_own on public.community_comments for insert with check (
  author_id = auth.uid() and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published' and (p.visibility = 'public' or private.is_workspace_member(p.workspace_id)))
);
create policy community_comments_update_own on public.community_comments for update using (author_id = auth.uid() and status <> 'removed') with check (author_id = auth.uid());
create policy community_comments_delete_own on public.community_comments for delete using (author_id = auth.uid());

create policy community_reactions_select_visible on public.community_reactions for select using (exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published' and (p.visibility = 'public' or private.is_workspace_member(p.workspace_id))));
create policy community_reactions_insert_own on public.community_reactions for insert with check (user_id = auth.uid() and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published' and (p.visibility = 'public' or private.is_workspace_member(p.workspace_id))));
create policy community_reactions_update_own on public.community_reactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy community_reactions_delete_own on public.community_reactions for delete using (user_id = auth.uid());

create policy community_reports_insert_own on public.community_reports for insert with check (reporter_id = auth.uid());
create policy community_reports_select_own on public.community_reports for select using (reporter_id = auth.uid());

create table public.reward_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null check (points between -10000 and 10000 and points <> 0),
  source_type text not null check (char_length(source_type) between 2 and 60),
  source_id uuid,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  description text not null check (char_length(description) between 3 and 240),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table public.reward_badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(name) between 2 and 80),
  description text not null check (char_length(description) between 3 and 240),
  points_threshold integer not null check (points_threshold >= 0),
  created_at timestamptz not null default now()
);

create table public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.reward_badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create index reward_transactions_user_created_idx on public.reward_transactions(user_id, created_at desc);
create index user_badges_user_awarded_idx on public.user_badges(user_id, awarded_at desc);

alter table public.reward_accounts enable row level security;
alter table public.reward_transactions enable row level security;
alter table public.reward_badges enable row level security;
alter table public.user_badges enable row level security;

create policy reward_accounts_select_own on public.reward_accounts for select using (user_id = auth.uid());
create policy reward_transactions_select_own on public.reward_transactions for select using (user_id = auth.uid());
create policy reward_badges_select_all on public.reward_badges for select using (true);
create policy user_badges_select_own on public.user_badges for select using (user_id = auth.uid());

insert into public.reward_badges (code, name, description, points_threshold)
values
  ('first_signal', 'First signal', 'Share your first verified community contribution.', 5),
  ('feedback_starter', 'Feedback starter', 'Reach 25 contribution points through useful feedback.', 25),
  ('community_builder', 'Community builder', 'Reach 75 contribution points through constructive participation.', 75)
on conflict (code) do update set name = excluded.name, description = excluded.description, points_threshold = excluded.points_threshold;

create or replace function public.award_reward_points(
  p_user_id uuid,
  p_points integer,
  p_source_type text,
  p_source_id uuid,
  p_idempotency_key text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  transaction_row public.reward_transactions;
  current_balance integer;
  badge_row record;
begin
  if p_user_id is null or p_points = 0 or abs(p_points) > 100 then raise exception 'INVALID_REWARD'; end if;
  insert into public.reward_accounts (user_id, balance) values (p_user_id, 0) on conflict (user_id) do nothing;
  insert into public.reward_transactions (user_id, points, source_type, source_id, idempotency_key, description)
  values (p_user_id, p_points, p_source_type, p_source_id, p_idempotency_key, p_description)
  on conflict (user_id, idempotency_key) do nothing
  returning * into transaction_row;
  if transaction_row.id is not null then
    update public.reward_accounts set balance = greatest(0, balance + transaction_row.points), updated_at = now() where user_id = p_user_id returning balance into current_balance;
    for badge_row in select id from public.reward_badges where points_threshold <= current_balance loop
      insert into public.user_badges (user_id, badge_id) values (p_user_id, badge_row.id) on conflict do nothing;
    end loop;
  else
    select balance into current_balance from public.reward_accounts where user_id = p_user_id;
  end if;
  return jsonb_build_object('awarded', coalesce(transaction_row.points, 0), 'balance', coalesce(current_balance, 0), 'idempotencyKey', p_idempotency_key);
end;
$$;

revoke all on function public.award_reward_points(uuid, integer, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.award_reward_points(uuid, integer, text, uuid, text, text) to service_role;
