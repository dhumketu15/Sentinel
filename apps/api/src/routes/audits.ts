import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { getUserScopedClient } from "../lib/supabase.js";
import { auditIdParamSchema, createAuditSchema, reviewFindingSchema } from "../schemas/brandAudit.js";
import { scoreAudit } from "../services/audit.js";

export const auditsRouter = Router();
function clientFor(req: AuthenticatedRequest) { return req.accessToken ? getUserScopedClient(req.accessToken) : null; }

async function runAudit(req: AuthenticatedRequest, input: z.infer<typeof createAuditSchema>, client: ReturnType<typeof clientFor>, idempotencyKey?: string) {
  if (!client || !req.user?.id) throw new Error("SUPABASE_UNAVAILABLE");
  if (idempotencyKey) {
    const { data: existing } = await client.from("audits").select("*").eq("created_by", req.user.id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing) {
      const { data: existingFindings } = await client.from("audit_findings").select("*").eq("audit_id", existing.id).order("created_at", { ascending: true });
      return { ...existing, findings: existingFindings ?? [] };
    }
  }
  const { data: brand, error: brandError } = await client.from("brands").select("id, workspace_id, name, prohibited_phrases, preferred_tone").eq("id", input.brandId).eq("workspace_id", input.workspaceId).single();
  if (brandError || !brand) throw new Error("BRAND_NOT_FOUND");
  const { data: guideline, error: guidelineError } = await client.from("brand_guideline_versions").select("id, status, version_number, title").eq("id", input.guidelineVersionId).eq("brand_id", input.brandId).eq("workspace_id", input.workspaceId).single();
  if (guidelineError || !guideline || guideline.status !== "approved") throw new Error("GUIDELINE_NOT_APPROVED");
  const { data: rules, error: rulesError } = await client.from("brand_rules").select("id, rule_key, title, description, category, severity, evaluation_instructions, compliant_examples, noncompliant_examples, source_reference, mandatory").eq("guideline_version_id", input.guidelineVersionId).eq("workspace_id", input.workspaceId);
  if (rulesError) throw new Error("RULES_LOOKUP_FAILED");
  const { data: audit, error: auditError } = await client.from("audits").insert({ workspace_id: brand.workspace_id, brand_id: input.brandId, guideline_version_id: input.guidelineVersionId, content_type: input.contentType, content_text: input.contentText, status: "processing", created_by: req.user.id, is_demo: true, model_id: "deterministic-demo-v1", prompt_version: "audit-rules-1", scorer_version: "deterministic-demo-v1", rule_snapshot: rules ?? [], idempotency_key: idempotencyKey ?? null }).select("*").single();
  if (auditError || !audit) throw new Error("AUDIT_CREATE_FAILED");
  const result = scoreAudit(input.contentText, brand, rules ?? []);
  if (result.findings.length > 0) {
    const { data: insertedFindings, error: findingsError } = await client.from("audit_findings").insert(result.findings.map((finding) => ({ ...finding, workspace_id: brand.workspace_id, brand_id: input.brandId, guideline_version_id: input.guidelineVersionId, audit_id: audit.id }))).select("*");
    if (findingsError) {
      await client.from("audits").update({ status: "failed" }).eq("id", audit.id);
      throw new Error("FINDINGS_CREATE_FAILED");
    }
    const { data: completed, error: completeError } = await client.from("audits").update({ status: "completed", overall_score: result.score, risk_class: result.riskClass, summary: result.summary, model_id: result.modelId, prompt_version: result.promptVersion, scorer_version: result.modelId, is_demo: result.isDemo, completed_at: new Date().toISOString() }).eq("id", audit.id).select("*").single();
    if (completeError || !completed) throw new Error("AUDIT_COMPLETE_FAILED");
    return { ...completed, findings: insertedFindings ?? [], guideline_version: guideline };
  }
  const { data: completed, error: completeError } = await client.from("audits").update({ status: "completed", overall_score: result.score, risk_class: result.riskClass, summary: result.summary, model_id: result.modelId, prompt_version: result.promptVersion, scorer_version: result.modelId, is_demo: result.isDemo, completed_at: new Date().toISOString() }).eq("id", audit.id).select("*").single();
  if (completeError || !completed) throw new Error("AUDIT_COMPLETE_FAILED");
  return { ...completed, findings: [], guideline_version: guideline };
}

auditsRouter.get("/audits", requireAuth, async (req: AuthenticatedRequest, res) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined; const client = clientFor(req);
  if (!workspaceId || !client) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "WORKSPACE_REQUIRED", message: !client ? "Audit service is not configured." : "A workspaceId query parameter is required." } }); return; }
  const { data, error } = await client.from("audits").select("id, workspace_id, brand_id, guideline_version_id, content_type, content_text, status, overall_score, risk_class, summary, is_demo, created_at, completed_at, brands(name), brand_guideline_versions(version_number, title)").eq("workspace_id", workspaceId).eq("status", "completed").order("created_at", { ascending: false }).limit(100);
  if (error) { res.status(500).json({ error: { code: "AUDITS_LOOKUP_FAILED", message: "Unable to load audit history." } }); return; }
  res.json({ data: data ?? [] });
});

auditsRouter.post("/audits", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = createAuditSchema.safeParse(req.body); const client = clientFor(req);
  if (!parsed.success || !client) {
    const message = !client ? "Audit service is not configured." : parsed.success ? "A valid audit payload is required." : parsed.error.issues[0]?.message ?? "Audit details are invalid.";
    res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_AUDIT", message } });
    return;
  }
  const idempotencyKey = req.header("x-idempotency-key")?.trim().slice(0, 160);
  try { const data = await runAudit(req, parsed.data, client, idempotencyKey); res.status(201).json({ data }); }
  catch (error) { const code = error instanceof Error ? error.message : "AUDIT_FAILED"; const status = code === "BRAND_NOT_FOUND" || code === "GUIDELINE_NOT_APPROVED" ? 400 : code === "SUPABASE_UNAVAILABLE" ? 503 : 500; res.status(status).json({ error: { code, message: code === "GUIDELINE_NOT_APPROVED" ? "Choose an approved guideline version before auditing." : code === "BRAND_NOT_FOUND" ? "Brand profile was not found in this workspace." : "The audit could not be completed." } }); }
});

auditsRouter.get("/audits/:auditId", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = auditIdParamSchema.safeParse(req.params); const client = clientFor(req);
  if (!parsed.success || !client) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_AUDIT_ID", message: !client ? "Audit service is not configured." : "Audit ID is invalid." } }); return; }
  const { data: audit, error } = await client.from("audits").select("*, brands(name), brand_guideline_versions(version_number, title)").eq("id", parsed.data.auditId).maybeSingle();
  if (error || !audit) { res.status(error ? 500 : 404).json({ error: { code: "AUDIT_NOT_FOUND", message: "Audit was not found or is not accessible." } }); return; }
  const { data: findings } = await client.from("audit_findings").select("*").eq("audit_id", parsed.data.auditId).order("created_at", { ascending: true });
  res.json({ data: { ...audit, findings: findings ?? [] } });
});

auditsRouter.post("/audits/:auditId/reviews", requireAuth, async (req: AuthenticatedRequest, res) => {
  const params = auditIdParamSchema.safeParse(req.params); const parsed = reviewFindingSchema.safeParse(req.body); const client = clientFor(req);
  if (!params.success || !parsed.success || !client || !req.user?.id) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "INVALID_REVIEW", message: !client ? "Review service is not configured." : "Review details are invalid." } }); return; }
  const { data: finding, error: findingError } = await client.from("audit_findings").select("id, workspace_id").eq("id", parsed.data.findingId).eq("audit_id", params.data.auditId).maybeSingle();
  if (findingError || !finding) { res.status(404).json({ error: { code: "FINDING_NOT_FOUND", message: "Finding was not found for this audit." } }); return; }
  const { error: updateError } = await client.from("audit_findings").update({ review_status: parsed.data.decision }).eq("id", parsed.data.findingId);
  if (updateError) { res.status(500).json({ error: { code: "FINDING_REVIEW_FAILED", message: "Unable to update the finding review state." } }); return; }
  const { data: review, error } = await client.from("audit_reviews").insert({ workspace_id: finding.workspace_id, audit_id: params.data.auditId, finding_id: parsed.data.findingId, user_id: req.user.id, decision: parsed.data.decision, note: parsed.data.note }).select("*").single();
  if (error) { res.status(500).json({ error: { code: "REVIEW_CREATE_FAILED", message: "The finding was updated but the review record could not be created." } }); return; }
  res.status(201).json({ data: review });
});
