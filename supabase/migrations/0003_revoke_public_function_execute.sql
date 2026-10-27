revoke execute on function public.handle_new_user() from public;
revoke execute on function public.add_workspace_owner_membership() from public;
revoke execute on function public.is_workspace_member(uuid) from public;
revoke execute on function public.has_workspace_role(uuid, public.workspace_member_role[]) from public;
