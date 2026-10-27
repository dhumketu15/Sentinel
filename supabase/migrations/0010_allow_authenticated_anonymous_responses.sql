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
  if not survey_row.anonymous and auth.uid() is not null and p_respondent_id is distinct from auth.uid() then raise exception 'RESPONDENT_MISMATCH'; end if;
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
  values (p_survey_id, p_workspace_id, case when survey_row.anonymous then null else p_respondent_id end, case when survey_row.anonymous then p_session_key else null end, 'submitted', now())
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

grant execute on function public.submit_survey_response(uuid, uuid, uuid, text, jsonb) to anon, authenticated;
