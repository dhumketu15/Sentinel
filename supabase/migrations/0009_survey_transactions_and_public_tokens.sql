alter table public.surveys add column public_token text;
update public.surveys set public_token = encode(gen_random_bytes(18), 'hex') where public_token is null;
alter table public.surveys alter column public_token set not null;
create unique index surveys_public_token_uidx on public.surveys(public_token);

create policy surveys_delete_creator_draft on public.surveys for delete using (created_by = auth.uid() and status = 'draft');

create or replace function public.replace_survey_questions(
  p_survey_id uuid,
  p_workspace_id uuid,
  p_questions jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  survey_row public.surveys;
  response_count integer;
begin
  if not private.has_workspace_role(p_workspace_id, array['administrator', 'editor']::public.workspace_member_role[]) then
    raise exception 'SURVEY_EDITOR_REQUIRED';
  end if;
  select * into survey_row from public.surveys where id = p_survey_id and workspace_id = p_workspace_id;
  if not found then raise exception 'SURVEY_NOT_FOUND'; end if;
  select count(*) into response_count from public.survey_responses where survey_id = p_survey_id;
  if response_count > 0 then raise exception 'SURVEY_HAS_RESPONSES'; end if;
  delete from public.survey_questions where survey_id = p_survey_id and workspace_id = p_workspace_id;
  insert into public.survey_questions (survey_id, workspace_id, question_type, prompt, options, position, required, config)
  select p_survey_id, p_workspace_id, q.question_type::public.survey_question_type, q.prompt, coalesce(q.options, '[]'::jsonb), q.position, coalesce(q.required, true), coalesce(q.config, '{}'::jsonb)
  from jsonb_to_recordset(p_questions) as q(question_type text, prompt text, options jsonb, position integer, required boolean, config jsonb);
end;
$$;

create or replace function public.submit_survey_response(
  p_survey_id uuid,
  p_workspace_id uuid,
  p_respondent_id uuid,
  p_session_key text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  survey_row public.surveys;
  response_row public.survey_responses;
  inserted_answers integer;
  required_missing integer;
begin
  select * into survey_row
  from public.surveys
  where id = p_survey_id and workspace_id = p_workspace_id and status = 'published'
    and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now());
  if not found then raise exception 'SURVEY_NOT_OPEN'; end if;
  if auth.uid() is null and p_respondent_id is not null then raise exception 'RESPONDENT_MISMATCH'; end if;
  if auth.uid() is not null and p_respondent_id is distinct from auth.uid() then raise exception 'RESPONDENT_MISMATCH'; end if;
  if survey_row.anonymous and p_session_key is null then raise exception 'ANONYMOUS_SESSION_REQUIRED'; end if;
  if not survey_row.anonymous and p_respondent_id is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_survey_id::text, 0));
  if survey_row.max_responses is not null and (select count(*) from public.survey_responses where survey_id = p_survey_id and status = 'submitted') >= survey_row.max_responses then raise exception 'SURVEY_LIMIT_REACHED'; end if;
  if survey_row.anonymous then
    if exists (select 1 from public.survey_responses where survey_id = p_survey_id and anonymous_session_key = p_session_key) then raise exception 'DUPLICATE_RESPONSE'; end if;
  else
    if exists (select 1 from public.survey_responses where survey_id = p_survey_id and respondent_id = p_respondent_id) then raise exception 'DUPLICATE_RESPONSE'; end if;
  end if;
  select count(*) into required_missing
  from public.survey_questions q
  where q.survey_id = p_survey_id and q.required
    and not exists (select 1 from jsonb_to_recordset(p_answers) as a(question_id uuid, answer jsonb) where a.question_id = q.id and a.answer is not null);
  if required_missing > 0 then raise exception 'REQUIRED_ANSWER_MISSING'; end if;
  insert into public.survey_responses (survey_id, workspace_id, respondent_id, anonymous_session_key, status, submitted_at)
  values (p_survey_id, p_workspace_id, p_respondent_id, p_session_key, 'submitted', now())
  returning * into response_row;
  insert into public.survey_answers (response_id, survey_id, question_id, workspace_id, answer)
  select response_row.id, p_survey_id, q.question_id, p_workspace_id, q.answer
  from jsonb_to_recordset(p_answers) as q(question_id uuid, answer jsonb)
  join public.survey_questions sq on sq.id = q.question_id and sq.survey_id = p_survey_id and sq.workspace_id = p_workspace_id;
  get diagnostics inserted_answers = row_count;
  if inserted_answers <> jsonb_array_length(p_answers) then raise exception 'UNKNOWN_QUESTION'; end if;
  return jsonb_build_object('id', response_row.id, 'survey_id', response_row.survey_id, 'submitted_at', response_row.submitted_at, 'thank_you_message', survey_row.thank_you_message);
end;
$$;

revoke all on function public.replace_survey_questions(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_survey_questions(uuid, uuid, jsonb) to authenticated;
revoke all on function public.submit_survey_response(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_survey_response(uuid, uuid, uuid, text, jsonb) to anon, authenticated;
