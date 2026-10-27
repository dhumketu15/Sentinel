revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.add_workspace_owner_membership() from anon, authenticated;
revoke execute on function public.is_workspace_member(uuid) from anon, authenticated;
revoke execute on function public.has_workspace_role(uuid, public.workspace_member_role[]) from anon, authenticated;
