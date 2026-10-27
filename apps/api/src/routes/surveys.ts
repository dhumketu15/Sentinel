import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { getPublicClient, getServiceClient, getUserScopedClient } from "../lib/supabase.js";
import { createSurveySchema, surveyIdParamSchema, submitSurveySchema, updateSurveySchema } from "../schemas/surveys.js";

export const surveysRouter = Router();
function clientFor(req: AuthenticatedRequest) { return req.accessToken ? getUserScopedClient(req.accessToken) : null; }

type QuestionRecord = { id: string; question_type: string; prompt: string; options: unknown; position: number; required: boolean; config?: Record<string, unknown> };

function questionDefinitionError(question: { questionType: string; options: string[] }) {
  if ((question.questionType === "single_choice" || question.questionType === "multiple_choice") && question.options.length < 2) return "Choice questions need at least two options.";
  if (question.questionType === "nps" && question.options.length > 0) return "NPS questions use the built-in 0–10 scale and do not need options.";
  return null;
}

function answerError(question: QuestionRecord, value: unknown) {
  const options = Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === "string") : [];
  if (question.question_type === "single_choice") return typeof value === "string" && options.includes(value) ? null : "Choose one of the available options.";
  if (question.question_type === "multiple_choice") return Array.isArray(value) && value.every((item) => typeof item === "string" && options.includes(item)) ? null : "Choose only available options.";
  if (question.question_type === "rating") return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5 ? null : "Rating must be a whole number from 1 to 5.";
  if (question.question_type === "nps") return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10 ? null : "NPS must be a whole number from 0 to 10.";
  if (question.question_type === "yes_no") return typeof value === "boolean" ? null : "Yes/no answers must be boolean.";
  if (question.question_type === "short_text") return typeof value === "string" && value.length <= 500 ? null : "Short text must be 500 characters or fewer.";
  if (question.question_type === "long_text" || question.question_type === "demographic") return typeof value === "string" && value.length <= 5000 ? null : "This answer must be text up to 5,000 characters.";
  return "Answer type is not supported.";
}

async function getSurvey(client: ReturnType<typeof clientFor>, surveyId: string) {
  if (!client) return { survey: null, error: new Error("SUPABASE_UNAVAILABLE") };
  const { data: survey, error } = await client.from("surveys").select("*, brands(name), survey_questions(id, question_type, prompt, options, position, required, config)").eq("id", surveyId).maybeSingle();
  return { survey, error };
}

async function getPublicSurvey(publicToken: string) {
  const client = getPublicClient();
  if (!client) return { client: null, survey: null, error: new Error("SUPABASE_UNAVAILABLE") };
  const { data: survey, error } = await client.from("surveys").select("id, public_token, workspace_id, title, description, audience, anonymous, max_responses, thank_you_message, starts_at, ends_at, status, brands(name), survey_questions(id, question_type, prompt, options, position, required, config)").eq("public_token", publicToken).eq("status", "published").maybeSingle();
  return { client, survey, error };
}

surveysRouter.get("/surveys/discover", requireAuth, async (req: AuthenticatedRequest, res) => {
  const client = clientFor(req);
  if (!client) { res.status(503).json({ error: { code: "SUPABASE_UNAVAILABLE", message: "Survey service is not configured." } }); return; }
  const { data, error } = await client.from("surveys").select("id, public_token, title, description, audience, anonymous, max_responses, thank_you_message, starts_at, ends_at, status, brands(name), survey_questions(id, question_type, prompt, options, position, required)").eq("status", "published").order("created_at", { ascending: false }).limit(100);
  if (error) { res.status(500).json({ error: { code: "SURVEY_DISCOVERY_FAILED", message: "Unable to discover published surveys." } }); return; }
  res.json({ data: data ?? [] });
});

surveysRouter.get("/public-surveys/:publicToken", async (req, res) => {
  const publicToken = typeof req.params.publicToken === "string" ? req.params.publicToken.trim() : "";
  const { survey, error } = await getPublicSurvey(publicToken);
  if (error?.message === "SUPABASE_UNAVAILABLE") { res.status(503).json({ error: { code: "SUPABASE_UNAVAILABLE", message: "Public survey service is not configured." } }); return; }
  if (error || !survey) { res.status(404).json({ error: { code: "PUBLIC_SURVEY_NOT_FOUND", message: "This survey link is invalid or no longer published." } }); return; }
  if (survey.starts_at && new Date(survey.starts_at) > new Date()) { res.status(409).json({ error: { code: "SURVEY_NOT_STARTED", message: "This survey is not open yet." } }); return; }
  if (survey.ends_at && new Date(survey.ends_at) < new Date()) { res.status(410).json({ error: { code: "SURVEY_ENDED", message: "This survey has closed." } }); return; }
  res.json({ data: survey });
});

surveysRouter.post("/public-surveys/:publicToken/responses", async (req, res) => {
  const parsed = submitSurveySchema.safeParse(req.body);
  const publicToken = typeof req.params.publicToken === "string" ? req.params.publicToken.trim() : "";
  const { client, survey, error: surveyError } = await getPublicSurvey(publicToken);
  if (!parsed.success) { res.status(400).json({ error: { code: "INVALID_RESPONSE", message: parsed.error.issues[0]?.message ?? "Survey response is invalid." } }); return; }
  if (!client) { res.status(503).json({ error: { code: "SUPABASE_UNAVAILABLE", message: "Public survey service is not configured." } }); return; }
  if (surveyError || !survey) { res.status(404).json({ error: { code: "PUBLIC_SURVEY_NOT_FOUND", message: "This survey link is invalid or no longer published." } }); return; }
  if (!survey.anonymous) { res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "This survey requires a signed-in response; use the workspace survey page." } }); return; }
  if (!parsed.data.anonymousSessionKey) { res.status(400).json({ error: { code: "ANONYMOUS_SESSION_REQUIRED", message: "This survey link needs a browser session key." } }); return; }
  const questions = ((survey.survey_questions ?? []) as QuestionRecord[]).sort((a, b) => a.position - b.position);
  const answerMap = new Map(parsed.data.answers.map((answer) => [answer.questionId, answer.value]));
  if (answerMap.size !== parsed.data.answers.length) { res.status(400).json({ error: { code: "DUPLICATE_QUESTION", message: "Each question can only be answered once." } }); return; }
  for (const question of questions) { const value = answerMap.get(question.id); if (question.required && (value === undefined || value === "" || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0))) { res.status(400).json({ error: { code: "REQUIRED_ANSWER_MISSING", message: `Answer required: ${question.prompt}` } }); return; } if (value !== undefined) { const issue = answerError(question, value); if (issue) { res.status(400).json({ error: { code: "INVALID_ANSWER", message: `${question.prompt}: ${issue}` } }); return; } } }
  if (parsed.data.answers.some((answer) => !questions.some((question) => question.id === answer.questionId))) { res.status(400).json({ error: { code: "UNKNOWN_QUESTION", message: "One or more answers do not belong to this survey." } }); return; }
  const writer = getServiceClient();
  if (!writer) { res.status(503).json({ error: { code: "SUPABASE_SERVICE_UNAVAILABLE", message: "Public response writes are not configured on this server." } }); return; }
  const { data, error } = await writer.rpc("submit_survey_response", { p_survey_id: survey.id, p_workspace_id: survey.workspace_id, p_respondent_id: null, p_session_key: parsed.data.anonymousSessionKey, p_answers: parsed.data.answers.map((answer) => ({ question_id: answer.questionId, answer: answer.value })) });
  if (error) { const duplicate = error.message.includes("DUPLICATE_RESPONSE"); const limited = error.message.includes("SURVEY_LIMIT_REACHED"); res.status(duplicate || limited ? 409 : 500).json({ error: { code: duplicate ? "DUPLICATE_RESPONSE" : limited ? "SURVEY_LIMIT_REACHED" : "PUBLIC_RESPONSE_FAILED", message: duplicate ? "You have already responded to this survey." : limited ? "This survey has reached its response limit." : "Unable to save this response." } }); return; }
  res.status(201).json({ data });
});

surveysRouter.get("/surveys", requireAuth, async (req: AuthenticatedRequest, res) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const client = clientFor(req);
  if (!client || !workspaceId) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "WORKSPACE_REQUIRED", message: !client ? "Survey service is not configured." : "A workspaceId query parameter is required." } }); return; }
  const { data, error } = await client.from("surveys").select("*, brands(name), survey_questions(id, question_type, prompt, options, position, required)").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100);
  if (error) { res.status(500).json({ error: { code: "SURVEYS_LOOKUP_FAILED", message: "Unable to load workspace surveys." } }); return; }
  res.json({ data: data ?? [] });
});

surveysRouter.get("/surveys/:surveyId", requireAuth, async (req: AuthenticatedRequest, res) => {
  const params = surveyIdParamSchema.safeParse(req.params); const client = clientFor(req);
  if (!params.success || !client) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_SURVEY_ID", message: !client ? "Survey service is not configured." : "Survey ID is invalid." } }); return; }
  const { survey, error } = await getSurvey(client, params.data.surveyId);
  if (error || !survey) { res.status(error ? 500 : 404).json({ error: { code: "SURVEY_NOT_FOUND", message: "Survey was not found or is not accessible." } }); return; }
  res.json({ data: survey });
});

surveysRouter.post("/surveys", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = createSurveySchema.safeParse(req.body); const client = clientFor(req);
  if (!parsed.success || !client || !req.user?.id) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_SURVEY", message: !client ? "Survey service is not configured." : parsed.success ? "A valid session is required." : parsed.error.issues[0]?.message ?? "Survey details are invalid." } }); return; }
  const definitionError = parsed.data.questions.map(questionDefinitionError).find(Boolean);
  if (definitionError) { res.status(400).json({ error: { code: "INVALID_QUESTION", message: definitionError } }); return; }
  const { data: brand, error: brandError } = await client.from("brands").select("id, workspace_id").eq("id", parsed.data.brandId).eq("workspace_id", parsed.data.workspaceId).maybeSingle();
  if (brandError || !brand) { res.status(400).json({ error: { code: "BRAND_WORKSPACE_MISMATCH", message: "The selected brand does not belong to this workspace." } }); return; }
  const { data: survey, error: surveyError } = await client.from("surveys").insert({ workspace_id: brand.workspace_id, brand_id: brand.id, created_by: req.user.id, title: parsed.data.title, description: parsed.data.description, cover_image_url: parsed.data.coverImageUrl, starts_at: parsed.data.startsAt, ends_at: parsed.data.endsAt, audience: parsed.data.audience, anonymous: parsed.data.anonymous, max_responses: parsed.data.maxResponses ?? null, thank_you_message: parsed.data.thankYouMessage, status: "draft" }).select("*").single();
  if (surveyError || !survey) { res.status(500).json({ error: { code: "SURVEY_CREATE_FAILED", message: "Unable to create survey." } }); return; }
  const questions = parsed.data.questions.map((question) => ({ question_type: question.questionType, prompt: question.prompt, options: question.options, position: question.position, required: question.required, config: question.config }));
  const { error: questionsError } = await client.rpc("replace_survey_questions", { p_survey_id: survey.id, p_workspace_id: brand.workspace_id, p_questions: questions });
  if (questionsError) { const { error: cleanupError } = await client.from("surveys").delete().eq("id", survey.id); if (cleanupError) { res.status(500).json({ error: { code: "SURVEY_ROLLBACK_FAILED", message: "Survey creation failed and requires administrator cleanup." } }); return; } res.status(500).json({ error: { code: "SURVEY_QUESTIONS_CREATE_FAILED", message: "The survey was rolled back because its questions could not be saved." } }); return; }
  const result = await getSurvey(client, survey.id);
  res.status(201).json({ data: result.survey });
});

surveysRouter.patch("/surveys/:surveyId", requireAuth, async (req: AuthenticatedRequest, res) => {
  const params = surveyIdParamSchema.safeParse(req.params); const parsed = updateSurveySchema.safeParse(req.body); const client = clientFor(req);
  if (!params.success || !parsed.success || !client) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_SURVEY_UPDATE", message: !client ? "Survey service is not configured." : "Survey update is invalid." } }); return; }
  if (parsed.data.questions) { const definitionError = parsed.data.questions.map(questionDefinitionError).find(Boolean); if (definitionError) { res.status(400).json({ error: { code: "INVALID_QUESTION", message: definitionError } }); return; } }
  const { data: current, error: currentError } = await client.from("surveys").select("id, workspace_id, status, starts_at, ends_at").eq("id", params.data.surveyId).maybeSingle();
  if (currentError || !current) { res.status(404).json({ error: { code: "SURVEY_NOT_FOUND", message: "Survey was not found or is not accessible." } }); return; }
  const mergedStart = parsed.data.startsAt ?? current.starts_at;
  const mergedEnd = parsed.data.endsAt ?? current.ends_at;
  if (mergedStart && mergedEnd && new Date(mergedEnd) <= new Date(mergedStart)) { res.status(400).json({ error: { code: "INVALID_SURVEY_DATES", message: "End date must be after the start date." } }); return; }
  if (parsed.data.questions) {
    const { count } = await client.from("survey_responses").select("id", { count: "exact", head: true }).eq("survey_id", current.id);
    if ((count ?? 0) > 0) { res.status(409).json({ error: { code: "SURVEY_HAS_RESPONSES", message: "Questions cannot be reordered or removed after responses exist." } }); return; }
  }
  const { questions, ...surveyFields } = parsed.data;
  if (questions) {
    const update = Object.fromEntries(Object.entries(surveyFields).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value]));
    const { error } = await client.rpc("update_survey_with_questions", { p_survey_id: current.id, p_workspace_id: current.workspace_id, p_fields: update, p_questions: questions.map((question) => ({ question_type: question.questionType, prompt: question.prompt, options: question.options, position: question.position, required: question.required, config: question.config })) });
    if (error) { const hasResponses = error.message.includes("SURVEY_HAS_RESPONSES"); res.status(hasResponses ? 409 : 500).json({ error: { code: hasResponses ? "SURVEY_HAS_RESPONSES" : "SURVEY_QUESTIONS_UPDATE_FAILED", message: hasResponses ? "Questions cannot be reordered or removed after responses exist." : "Unable to update survey settings and questions." } }); return; }
  } else if (Object.keys(surveyFields).length > 0) {
    const update = Object.fromEntries(Object.entries(surveyFields).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value]));
    const { error } = await client.from("surveys").update(update).eq("id", current.id); if (error) { res.status(500).json({ error: { code: "SURVEY_UPDATE_FAILED", message: "Unable to update survey settings." } }); return; }
  }
  const result = await getSurvey(client, current.id); res.json({ data: result.survey });
});

surveysRouter.post("/surveys/:surveyId/publish", requireAuth, async (req: AuthenticatedRequest, res) => {
  const params = surveyIdParamSchema.safeParse(req.params); const client = clientFor(req);
  if (!params.success || !client) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_SURVEY_ID", message: !client ? "Survey service is not configured." : "Survey ID is invalid." } }); return; }
  const { survey, error } = await getSurvey(client, params.data.surveyId); const questions = (survey?.survey_questions ?? []) as QuestionRecord[];
  if (error || !survey) { res.status(404).json({ error: { code: "SURVEY_NOT_FOUND", message: "Survey was not found or is not accessible." } }); return; }
  if (survey.status === "closed") { res.status(409).json({ error: { code: "SURVEY_CLOSED", message: "A closed survey cannot be published again." } }); return; }
  if (questions.length === 0) { res.status(400).json({ error: { code: "SURVEY_NEEDS_QUESTION", message: "Add at least one question before publishing." } }); return; }
  if (survey.starts_at && survey.ends_at && new Date(survey.ends_at) <= new Date(survey.starts_at)) { res.status(400).json({ error: { code: "INVALID_SURVEY_DATES", message: "End date must be after the start date." } }); return; }
  if (survey.ends_at && new Date(survey.ends_at) < new Date()) { res.status(400).json({ error: { code: "SURVEY_ALREADY_ENDED", message: "Choose a future end date before publishing." } }); return; }
  const { data, error: updateError } = await client.from("surveys").update({ status: "published" }).eq("id", survey.id).select("*").single();
  if (updateError) { res.status(500).json({ error: { code: "SURVEY_PUBLISH_FAILED", message: "Unable to publish survey." } }); return; }
  res.json({ data });
});

surveysRouter.post("/surveys/:surveyId/pause", requireAuth, async (req: AuthenticatedRequest, res) => {
  const params = surveyIdParamSchema.safeParse(req.params); const client = clientFor(req);
  if (!params.success || !client) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_SURVEY_ID", message: !client ? "Survey service is not configured." : "Survey ID is invalid." } }); return; }
  const { data, error } = await client.from("surveys").update({ status: "paused" }).eq("id", params.data.surveyId).in("status", ["published", "draft"]).select("*").maybeSingle();
  if (error || !data) { res.status(409).json({ error: { code: "SURVEY_PAUSE_FAILED", message: "Only a draft or published survey can be paused." } }); return; }
  res.json({ data });
});

surveysRouter.post("/surveys/:surveyId/close", requireAuth, async (req: AuthenticatedRequest, res) => {
  const params = surveyIdParamSchema.safeParse(req.params); const client = clientFor(req);
  if (!params.success || !client) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_SURVEY_ID", message: !client ? "Survey service is not configured." : "Survey ID is invalid." } }); return; }
  const { data, error } = await client.from("surveys").update({ status: "closed" }).eq("id", params.data.surveyId).in("status", ["published", "paused"]).select("*").maybeSingle();
  if (error || !data) { res.status(409).json({ error: { code: "SURVEY_CLOSE_FAILED", message: "Only a published or paused survey can be closed." } }); return; }
  res.json({ data });
});

surveysRouter.post("/surveys/:surveyId/responses", requireAuth, async (req: AuthenticatedRequest, res) => {
  const params = surveyIdParamSchema.safeParse(req.params); const parsed = submitSurveySchema.safeParse(req.body); const client = clientFor(req);
  if (!params.success || !parsed.success || !client || !req.user?.id) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_RESPONSE", message: !client ? "Survey service is not configured." : "Survey response is invalid." } }); return; }
  const { survey, error: surveyError } = await getSurvey(client, params.data.surveyId);
  if (surveyError || !survey || survey.status !== "published") { res.status(409).json({ error: { code: "SURVEY_NOT_OPEN", message: "This survey is not currently accepting responses." } }); return; }
  if (survey.starts_at && new Date(survey.starts_at) > new Date()) { res.status(409).json({ error: { code: "SURVEY_NOT_STARTED", message: "This survey is not open yet." } }); return; }
  if (survey.ends_at && new Date(survey.ends_at) < new Date()) { res.status(409).json({ error: { code: "SURVEY_ENDED", message: "This survey has closed." } }); return; }
  if (survey.anonymous && !parsed.data.anonymousSessionKey) { res.status(400).json({ error: { code: "ANONYMOUS_SESSION_REQUIRED", message: "An anonymous survey response needs a session key." } }); return; }
  const questions = ((survey.survey_questions ?? []) as QuestionRecord[]).sort((a, b) => a.position - b.position);
  const answerMap = new Map(parsed.data.answers.map((answer) => [answer.questionId, answer.value]));
  if (answerMap.size !== parsed.data.answers.length) { res.status(400).json({ error: { code: "DUPLICATE_QUESTION", message: "Each question can only be answered once." } }); return; }
  for (const question of questions) { const value = answerMap.get(question.id); if (question.required && (value === undefined || value === "" || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0))) { res.status(400).json({ error: { code: "REQUIRED_ANSWER_MISSING", message: `Answer required: ${question.prompt}` } }); return; } if (value !== undefined) { const issue = answerError(question, value); if (issue) { res.status(400).json({ error: { code: "INVALID_ANSWER", message: `${question.prompt}: ${issue}` } }); return; } } }
  if (parsed.data.answers.some((answer) => !questions.some((question) => question.id === answer.questionId))) { res.status(400).json({ error: { code: "UNKNOWN_QUESTION", message: "One or more answers do not belong to this survey." } }); return; }
  const respondentId = survey.anonymous ? null : req.user.id;
  const writer = getServiceClient();
  if (!writer) { res.status(503).json({ error: { code: "SUPABASE_SERVICE_UNAVAILABLE", message: "Response writes are not configured on this server." } }); return; }
  const { data, error: responseError } = await writer.rpc("submit_survey_response", { p_survey_id: survey.id, p_workspace_id: survey.workspace_id, p_respondent_id: respondentId, p_session_key: survey.anonymous ? parsed.data.anonymousSessionKey : null, p_answers: parsed.data.answers.map((answer) => ({ question_id: answer.questionId, answer: answer.value })) });
  if (responseError) { const duplicate = responseError.message.includes("DUPLICATE_RESPONSE"); const limited = responseError.message.includes("SURVEY_LIMIT_REACHED"); res.status(duplicate || limited ? 409 : 500).json({ error: { code: duplicate ? "DUPLICATE_RESPONSE" : limited ? "SURVEY_LIMIT_REACHED" : "RESPONSE_CREATE_FAILED", message: duplicate ? "You have already responded to this survey." : limited ? "This survey has reached its response limit." : "Unable to save this response." } }); return; }
  res.status(201).json({ data });
});

surveysRouter.get("/surveys/:surveyId/analytics", requireAuth, async (req: AuthenticatedRequest, res) => {
  const params = surveyIdParamSchema.safeParse(req.params); const client = clientFor(req);
  if (!params.success || !client) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_SURVEY_ID", message: !client ? "Survey service is not configured." : "Survey ID is invalid." } }); return; }
  const { survey, error: surveyError } = await getSurvey(client, params.data.surveyId);
  if (surveyError || !survey) { res.status(404).json({ error: { code: "SURVEY_NOT_FOUND", message: "Survey was not found or is not accessible." } }); return; }
  if (!req.user?.id) { res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "A valid session is required." } }); return; }
  const { data: membership } = await client.from("workspace_members").select("role").eq("workspace_id", survey.workspace_id).eq("user_id", req.user.id).maybeSingle();
  if (!membership || !["administrator", "editor"].includes(membership.role)) { res.status(403).json({ error: { code: "SURVEY_ANALYTICS_FORBIDDEN", message: "Only workspace administrators and editors can view survey analytics." } }); return; }
  const responses: any[] = [];
  for (let offset = 0; ; offset += 500) { const { data, error } = await client.from("survey_responses").select("id, status, submitted_at, created_at").eq("survey_id", survey.id).order("created_at", { ascending: true }).range(offset, offset + 499); if (error) { res.status(500).json({ error: { code: "SURVEY_ANALYTICS_FAILED", message: "Unable to aggregate survey responses." } }); return; } responses.push(...(data ?? [])); if ((data?.length ?? 0) < 500) break; }
  const answers: any[] = [];
  for (let offset = 0; ; offset += 500) { const { data, error } = await client.from("survey_answers").select("question_id, answer").eq("survey_id", survey.id).range(offset, offset + 499); if (error) { res.status(500).json({ error: { code: "SURVEY_ANALYTICS_FAILED", message: "Unable to aggregate survey answers." } }); return; } answers.push(...(data ?? [])); if ((data?.length ?? 0) < 500) break; }
  const submitted = (responses ?? []).filter((response) => response.status === "submitted");
  const answerRows = answers ?? [];
  const questionAnalytics = ((survey.survey_questions ?? []) as QuestionRecord[]).sort((a, b) => a.position - b.position).map((question) => {
    const values = answerRows.filter((answer) => answer.question_id === question.id).map((answer) => answer.answer);
    const distribution: Record<string, number> = {};
    values.forEach((value) => { const entries = Array.isArray(value) ? value : [value]; entries.forEach((entry) => { const key = String(entry); distribution[key] = (distribution[key] ?? 0) + 1; }); });
    const numeric = values.map(Number).filter((value) => Number.isFinite(value));
    const average = numeric.length ? Math.round(numeric.reduce((sum, value) => sum + value, 0) / numeric.length * 10) / 10 : null;
    const nps = question.question_type === "nps" && numeric.length ? Math.round((numeric.filter((value) => value >= 9).length / numeric.length - numeric.filter((value) => value <= 6).length / numeric.length) * 100) : null;
    return { id: question.id, prompt: question.prompt, questionType: question.question_type, responseCount: values.length, distribution, average, nps, writtenResponseCount: ["short_text", "long_text", "demographic"].includes(question.question_type) ? values.filter((value) => typeof value === "string" && value.length > 0).length : 0 };
  });
  res.json({ data: { surveyId: survey.id, responseCount: submitted.length, completionRate: null, questionAnalytics, note: "All stored responses are submitted in this slice, so completion rate is intentionally not estimated. Written-feedback themes are not generated until a safeguarded server-side summarizer is configured; raw answers remain access-controlled." } });
});
