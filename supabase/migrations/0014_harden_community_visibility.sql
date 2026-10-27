drop policy community_posts_update_own on public.community_posts;
create policy community_posts_update_own on public.community_posts for update using (author_id = auth.uid() and status <> 'removed') with check (
  author_id = auth.uid() and (visibility = 'public' or (workspace_id is not null and private.is_workspace_member(workspace_id)))
);

drop policy community_reports_insert_own on public.community_reports;
create policy community_reports_insert_own on public.community_reports for insert with check (
  reporter_id = auth.uid()
  and (
    (post_id is not null and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published' and (p.visibility = 'public' or private.is_workspace_member(p.workspace_id))))
    or (comment_id is not null and exists (select 1 from public.community_comments c join public.community_posts p on p.id = c.post_id where c.id = comment_id and c.status = 'published' and p.status = 'published' and (p.visibility = 'public' or private.is_workspace_member(p.workspace_id))))
  )
);
