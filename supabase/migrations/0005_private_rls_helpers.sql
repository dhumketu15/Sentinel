create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    case when new.raw_user_meta_data->>'requested_role' = 'business_owner' then 'business_owner'::public.user_role else 'consumer'::public.user_role end
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function private.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace and user_id = auth.uid()
  );
$$;

create or replace function private.has_workspace_role(target_workspace uuid, allowed_roles public.workspace_member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace and user_id = auth.uid() and role = any(allowed_roles)
  );
$$;

create or replace function private.add_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'administrator')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.add_workspace_owner_membership() from public, anon, authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, public.workspace_member_role[]) to authenticated;

 drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure private.handle_new_user();

drop trigger if exists workspace_owner_membership on public.workspaces;
create trigger workspace_owner_membership
after insert on public.workspaces
for each row execute procedure private.add_workspace_owner_membership();

drop policy if exists workspaces_select_member on public.workspaces;
drop policy if exists workspaces_update_admin on public.workspaces;
drop policy if exists workspace_members_select_member on public.workspace_members;
drop policy if exists workspace_members_insert_admin on public.workspace_members;
drop policy if exists workspace_members_update_admin on public.workspace_members;
drop policy if exists workspace_members_delete_admin on public.workspace_members;

create policy workspaces_select_member on public.workspaces for select using (private.is_workspace_member(id));
create policy workspaces_update_admin on public.workspaces for update using (owner_id = auth.uid() or private.has_workspace_role(id, array['administrator']::public.workspace_member_role[])) with check (owner_id = auth.uid() or private.has_workspace_role(id, array['administrator']::public.workspace_member_role[]));

create policy workspace_members_select_member on public.workspace_members for select using (private.is_workspace_member(workspace_id));
create policy workspace_members_insert_admin on public.workspace_members for insert with check (private.has_workspace_role(workspace_id, array['administrator']::public.workspace_member_role[]));
create policy workspace_members_update_admin on public.workspace_members for update using (private.has_workspace_role(workspace_id, array['administrator']::public.workspace_member_role[])) with check (private.has_workspace_role(workspace_id, array['administrator']::public.workspace_member_role[]));
create policy workspace_members_delete_admin on public.workspace_members for delete using (private.has_workspace_role(workspace_id, array['administrator']::public.workspace_member_role[]));

drop function if exists public.handle_new_user();
drop function if exists public.add_workspace_owner_membership();
drop function if exists public.is_workspace_member(uuid);
drop function if exists public.has_workspace_role(uuid, public.workspace_member_role[]);
