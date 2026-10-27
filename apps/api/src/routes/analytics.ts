import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { getUserScopedClient } from "../lib/supabase.js";

export const analyticsRouter = Router();

analyticsRouter.get("/analytics/overview", requireAuth, async (req: AuthenticatedRequest, res) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const brandId = typeof req.query.brandId === "string" ? req.query.brandId : undefined;
  const client = req.accessToken ? getUserScopedClient(req.accessToken) : null;
  if (!client || !workspaceId) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "SUPABASE_UNAVAILABLE" : "WORKSPACE_REQUIRED", message: !client ? "Analytics service is not configured." : "A workspaceId query parameter is required." } }); return; }
  const audits: Array<Record<string, any>> = [];
  for (let offset = 0; ; offset += 500) {
    let auditsQuery = client.from("audits").select("id, brand_id, overall_score, risk_class, content_type, status, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: true }).range(offset, offset + 499);
    if (brandId) auditsQuery = auditsQuery.eq("brand_id", brandId);
    const { data, error } = await auditsQuery;
    if (error) { res.status(500).json({ error: { code: "ANALYTICS_AUDITS_FAILED", message: "Unable to aggregate audit analytics." } }); return; }
    audits.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) break;
  }
  const findings: Array<Record<string, any>> = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("audit_findings").select("id, audit_id, severity, review_status, category, created_at").eq("workspace_id", workspaceId).range(offset, offset + 499);
    if (error) { res.status(500).json({ error: { code: "ANALYTICS_FINDINGS_FAILED", message: "Unable to aggregate finding analytics." } }); return; }
    findings.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) break;
  }
  const rows = audits.filter((audit) => audit.status === "completed" && typeof audit.overall_score === "number");
  const completedAuditIds = new Set(rows.map((audit) => audit.id));
  const scopedFindings = findings.filter((finding) => completedAuditIds.has(finding.audit_id));
  const scores = rows.map((audit) => Number(audit.overall_score));
  const averageScore = scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10 : null;
  const latestScore = scores.length ? (scores[scores.length - 1] ?? null) : null;
  const previousScore = scores.length > 1 ? (scores[scores.length - 2] ?? null) : null;
  const scoreChangePoints = latestScore !== null && previousScore !== null ? Math.round((latestScore - previousScore) * 10) / 10 : null;
  const riskDistribution = rows.reduce<Record<string, number>>((result, audit) => { const risk = audit.risk_class || "unclassified"; result[risk] = (result[risk] ?? 0) + 1; return result; }, {});
  const severityCounts = scopedFindings.reduce<Record<string, number>>((result, finding) => { result[finding.severity] = (result[finding.severity] ?? 0) + 1; return result; }, {});
  const resolvedFindings = scopedFindings.filter((finding) => finding.review_status === "accepted" || finding.review_status === "dismissed").length;
  const volumeByDay = rows.reduce<Record<string, { date: string; audits: number; averageScore: number | null }>>((result, audit) => { const date = String(audit.created_at).slice(0, 10); const bucket = result[date] ?? { date, audits: 0, averageScore: null }; bucket.audits += 1; bucket.averageScore = bucket.averageScore === null ? Number(audit.overall_score) : Math.round(((bucket.averageScore * (bucket.audits - 1)) + Number(audit.overall_score)) / bucket.audits * 10) / 10; result[date] = bucket; return result; }, {});
  const contentTypes = rows.reduce<Record<string, number>>((result, audit) => { result[audit.content_type] = (result[audit.content_type] ?? 0) + 1; return result; }, {});
  res.json({ data: { hasData: rows.length > 0, totalAudits: rows.length, averageScore, latestScore, scoreChangePoints, riskDistribution, severityCounts, totalFindings: scopedFindings.length, resolvedFindings, unresolvedFindings: Math.max(0, scopedFindings.length - resolvedFindings), contentTypes, volumeByDay: Object.values(volumeByDay).slice(-30) } });
});
