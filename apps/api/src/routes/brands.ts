import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { getUserScopedClient } from "../lib/supabase.js";
import { brandIdParamSchema, createBrandSchema, createGuidelineSchema, guidelineIdParamSchema, updateBrandSchema } from "../schemas/brandAudit.js";

export const brandsRouter = Router();

function clientFor(req: AuthenticatedRequest) { return req.accessToken ? getUserScopedClient(req.accessToken) : null; }

brandsRouter.get("/brands", requireAuth, async (req: AuthenticatedRequest, res) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const client = clientFor(req);
  if (!client || !workspaceId) { res.status(400).json({ error: { code: "WORKSPACE_REQUIRED", message: "A workspaceId query parameter is required." } }); return; }
  const { data, error } = await client.from("brands").select("id, workspace_id, name, description, industry, website, preferred_tone, updated_at, created_at").eq("workspace_id", workspaceId).order("updated_at", { ascending: false });
  if (error) { res.status(500).json({ error: { code: "BRANDS_LOOKUP_FAILED", message: "Unable to load brand profiles." } }); return; }
  res.json({ data: data ?? [] });
});

brandsRouter.post("/brands", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = createBrandSchema.safeParse(req.body); const client = clientFor(req);
  if (!parsed.success || !client || !req.user?.id) { res.status(parsed.success ? 503 : 400).json({ error: { code: parsed.success ? "SUPABASE_UNAVAILABLE" : "INVALID_BRAND", message: parsed.success ? "Brand service is not configured." : parsed.error.issues[0]?.message ?? "Brand details are invalid." } }); return; }
  const value = parsed.data;
  const { data, error } = await client.from("brands").insert({ workspace_id: value.workspaceId, name: value.name, description: value.description, industry: value.industry, website: value.website || null, mission: value.mission, values: value.values ?? [], personality: value.personality, target_audience: value.targetAudience, preferred_tone: value.preferredTone, prohibited_phrases: value.prohibitedPhrases ?? [], approved_terminology: value.approvedTerminology ?? [], required_disclaimers: value.requiredDisclaimers, industry_compliance: value.industryCompliance, created_by: req.user.id }).select("*").single();
  if (error) { res.status(500).json({ error: { code: "BRAND_CREATE_FAILED", message: "Unable to create the brand profile." } }); return; }
  res.status(201).json({ data });
});

brandsRouter.get("/brands/:brandId", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = brandIdParamSchema.safeParse(req.params); const client = clientFor(req);
  if (!parsed.success || !client) { res.status(parsed.success ? 503 : 400).json({ error: { code: parsed.success ? "SUPABASE_UNAVAILABLE" : "INVALID_BRAND_ID", message: parsed.success ? "Brand service is not configured." : "Brand ID is invalid." } }); return; }
  const { data, error } = await client.from("brands").select("*").eq("id", parsed.data.brandId).maybeSingle();
  if (error || !data) { res.status(error ? 500 : 404).json({ error: { code: "BRAND_NOT_FOUND", message: "Brand profile was not found or is not accessible." } }); return; }
  const { data: guidelines } = await client.from("brand_guideline_versions").select("id, version_number, status, title, source_document_name, approved_at, created_at, updated_at").eq("brand_id", parsed.data.brandId).order("version_number", { ascending: false });
  res.json({ data: { ...data, guidelines: guidelines ?? [] } });
});

brandsRouter.patch("/brands/:brandId", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = brandIdParamSchema.safeParse(req.params); const body = updateBrandSchema.safeParse(req.body); const client = clientFor(req);
  if (!parsed.success || !body.success || !client) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_BRAND_UPDATE", message: !client ? "Brand service is not configured." : "Brand update is invalid." } }); return; }
  const value = body.data;
  const { data, error } = await client.from("brands").update({ name: value.name, description: value.description, industry: value.industry, website: value.website || null, mission: value.mission, values: value.values, personality: value.personality, target_audience: value.targetAudience, preferred_tone: value.preferredTone, prohibited_phrases: value.prohibitedPhrases, approved_terminology: value.approvedTerminology, required_disclaimers: value.requiredDisclaimers, industry_compliance: value.industryCompliance }).eq("id", parsed.data.brandId).select("*").single();
  if (error) { res.status(500).json({ error: { code: "BRAND_UPDATE_FAILED", message: "Unable to update the brand profile." } }); return; }
  res.json({ data });
});

brandsRouter.get("/brands/:brandId/guidelines", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = brandIdParamSchema.safeParse(req.params); const client = clientFor(req);
  if (!parsed.success || !client) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_BRAND_ID", message: !client ? "Guideline service is not configured." : "Brand ID is invalid." } }); return; }
  const { data, error } = await client.from("brand_guideline_versions").select("id, workspace_id, brand_id, version_number, status, title, source_document_name, source_text, approved_by, approved_at, created_at, updated_at, brand_rules(*)").eq("brand_id", parsed.data.brandId).order("version_number", { ascending: false });
  if (error) { res.status(500).json({ error: { code: "GUIDELINES_LOOKUP_FAILED", message: "Unable to load guideline versions." } }); return; }
  res.json({ data: data ?? [] });
});

brandsRouter.post("/brands/:brandId/guidelines", requireAuth, async (req: AuthenticatedRequest, res) => {
  const params = brandIdParamSchema.safeParse(req.params); const parsed = createGuidelineSchema.safeParse(req.body); const client = clientFor(req);
  if (!params.success || !parsed.success || !client || !req.user?.id) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_GUIDELINE", message: !client ? "Guideline service is not configured." : parsed.success ? "A valid session is required." : parsed.error.issues[0]?.message ?? "Guideline details are invalid." } }); return; }
  const { data: parentBrand, error: parentBrandError } = await client.from("brands").select("id, workspace_id").eq("id", params.data.brandId).maybeSingle();
  if (parentBrandError || !parentBrand || parentBrand.workspace_id !== parsed.data.workspaceId) { res.status(400).json({ error: { code: "BRAND_WORKSPACE_MISMATCH", message: "The brand does not belong to the selected workspace." } }); return; }
  const workspaceId = parentBrand.workspace_id;
  const latest = await client.from("brand_guideline_versions").select("version_number").eq("brand_id", params.data.brandId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const versionNumber = (latest.data?.version_number ?? 0) + 1;
  const { data: version, error: versionError } = await client.from("brand_guideline_versions").insert({ workspace_id: workspaceId, brand_id: params.data.brandId, version_number: versionNumber, title: parsed.data.title, source_document_name: parsed.data.sourceDocumentName, source_text: parsed.data.sourceText, created_by: req.user.id, status: "pending_review" }).select("*").single();
  if (versionError || !version) { res.status(500).json({ error: { code: "GUIDELINE_CREATE_FAILED", message: "Unable to create the guideline version." } }); return; }
  const rules = parsed.data.rules.map((rule) => ({ workspace_id: workspaceId, brand_id: params.data.brandId, guideline_version_id: version.id, rule_key: rule.ruleKey, title: rule.title, description: rule.description, category: rule.category, severity: rule.severity, evaluation_instructions: rule.evaluationInstructions, compliant_examples: rule.compliantExamples ?? [], noncompliant_examples: rule.noncompliantExamples ?? [], source_reference: rule.sourceReference, mandatory: rule.mandatory }));
  const { data: createdRules, error: rulesError } = await client.from("brand_rules").insert(rules).select("*");
  if (rulesError) { await client.from("brand_guideline_versions").delete().eq("id", version.id); res.status(500).json({ error: { code: "GUIDELINE_RULES_CREATE_FAILED", message: "The guideline version was rolled back because its rules could not be saved." } }); return; }
  res.status(201).json({ data: { ...version, brand_rules: createdRules ?? [] } });
});

brandsRouter.post("/guidelines/:guidelineId/approve", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = guidelineIdParamSchema.safeParse(req.params); const client = clientFor(req);
  if (!parsed.success || !client || !req.user?.id) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_GUIDELINE_ID", message: !client ? "Guideline service is not configured." : "Guideline ID is invalid." } }); return; }
  const { data: current, error: currentError } = await client.from("brand_guideline_versions").select("status").eq("id", parsed.data.guidelineId).maybeSingle();
  if (currentError || !current) { res.status(404).json({ error: { code: "GUIDELINE_NOT_FOUND", message: "Guideline version was not found." } }); return; }
  if (current.status !== "pending_review") { res.status(409).json({ error: { code: "INVALID_GUIDELINE_TRANSITION", message: "Only a pending-review guideline can be approved." } }); return; }
  const { data, error } = await client.from("brand_guideline_versions").update({ status: "approved", approved_by: req.user.id, approved_at: new Date().toISOString() }).eq("id", parsed.data.guidelineId).eq("status", "pending_review").select("*").single();
  if (error) { res.status(500).json({ error: { code: "GUIDELINE_APPROVE_FAILED", message: "Unable to approve the guideline version." } }); return; }
  res.json({ data });
});
