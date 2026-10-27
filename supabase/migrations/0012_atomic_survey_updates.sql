create or replace function public.replace_survey_questions(
  p_survey_id uuid,
  p_workspace_id uuid,
  p_questions jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  survey_row public.surveys;
  response_count integer;
begin
  if not private.has_workspace_role(p_workspace_id, array['administrator', 'editor']::public.workspace_member_role[]) then
    raise exception 'SURVEY_EDITOR_REQUIRED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_survey_id::text, 0));
  select * into survey_row from public.surveys where id = p_survey_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'SURVEY_NOT_FOUND'; end if;
  select count(*) into response_count from public.survey_responses where survey_id = p_survey_id;
  if response_count > 0 then raise exception 'SURVEY_HAS_RESPONSES'; end if;
  delete from public.survey_questions where survey_id = p_survey_id and workspace_id = p_workspace_id;
  insert into public.survey_questions (survey_id, workspace_id, question_type, prompt, options, position, required, config)
  select p_survey_id, p_workspace_id, q.question_type::public.survey_question_type, q.prompt, coalesce(q.options, '[]'::jsonb), q.position, coalesce(q.required, true), coalesce(q.config, '{}'::jsonb)
  from jsonb_to_recordset(p_questions) as q(question_type text, prompt text, options jsonb, position integer, required boolean, config jsonb);
end;
$$;

create or replace function public.update_survey_with_questions(
  p_survey_id uuid,
  p_workspace_id uuid,
  p_fields jsonb,
  p_questions jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  survey_row public.surveys;
  response_count integer;
  next_start timestamptz;
  next_end timestamptz;
begin
  if not private.has_workspace_role(p_workspace_id, array['administrator', 'editor']::public.workspace_member_role[]) then
    raise exception 'SURVEY_EDITOR_REQUIRED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_survey_id::text, 0));
  select * into survey_row from public.surveys where id = p_survey_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'SURVEY_NOT_FOUND'; end if;
  select count(*) into response_count from public.survey_responses where survey_id = p_survey_id;
  if response_count > 0 then raise exception 'SURVEY_HAS_RESPONSES'; end if;
  next_start := case when p_fields ? 'starts_at' then nullif(p_fields->>'starts_at', '')::timestamptz else survey_row.starts_at end;
  next_end := case when p_fields ? 'ends_at' then nullif(p_fields->>'ends_at', '')::timestamptz else survey_row.ends_at end;
  if next_start is not null and next_end is not null and next_end <= next_start then raise exception 'INVALID_SURVEY_DATES'; end if;
  update public.surveys set
    title = case when p_fields ? 'title' then p_fields->>'title' else title end,
    description = case when p_fields ? 'description' then p_fields->>'description' else description end,
    cover_image_url = case when p_fields ? 'cover_image_url' then p_fields->>'cover_image_url' else cover_image_url end,
    starts_at = next_start,
    ends_at = next_end,
    audience = case when p_fields ? 'audience' then p_fields->>'audience' else audience end,
    anonymous = case when p_fields ? 'anonymous' then (p_fields->>'anonymous')::boolean else anonymous end,
    max_responses = case when p_fields ? 'max_responses' then nullif(p_fields->>'max_responses', '')::integer else max_responses end,
    thank_you_message = case when p_fields ? 'thank_you_message' then p_fields->>'thank_you_message' else thank_you_message end
  where id = p_survey_id and workspace_id = p_workspace_id;
  delete from public.survey_questions where survey_id = p_survey_id and workspace_id = p_workspace_id;
  insert into public.survey_questions (survey_id, workspace_id, question_type, prompt, options, position, required, config)
  select p_survey_id, p_workspace_id, q.question_type::public.survey_question_type, q.prompt, coalesce(q.options, '[]'::jsonb), q.position, coalesce(q.required, true), coalesce(q.config, '{}'::jsonb)
  from jsonb_to_recordset(p_questions) as q(question_type text, prompt text, options jsonb, position integer, required boolean, config jsonb);
end;
$$;

revoke all on function public.update_survey_with_questions(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_survey_with_questions(uuid, uuid, jsonb, jsonb) to authenticated;
