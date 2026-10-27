import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ClipboardCheck, FileText, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Badge, Button, Card, Field } from "../components/ui";
import { apiFetch } from "../lib/api";

type WorkspaceMembership = { role: string; workspaces: { id: string; name: string } | null };
type Brand = { id: string; name: string; industry?: string | null };
type Guideline = { id: string; version_number: number; status: string; title: string };
type Finding = { id: string; category: string; severity: string; description: string; evidence?: string | null; guideline_reference?: string | null; explanation: string; recommended_correction?: string | null; review_status: string };
type Audit = { id: string; brand_id: string; content_type: string; content_text: string; status: string; overall_score?: number | null; risk_class?: string | null; summary?: string | null; is_demo: boolean; created_at: string; brands?: { name: string } | null; brand_guideline_versions?: { version_number: number; title: string } | null; findings?: Finding[] };

const inputClass = "min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-50";

function scoreTone(score = 0): "green" | "amber" | "red" { return score >= 80 ? "green" : score >= 60 ? "amber" : "red"; }
function severityTone(severity: string): "neutral" | "amber" | "red" { return severity === "critical" || severity === "high" ? "red" : severity === "medium" ? "amber" : "neutral"; }

export function AuditsPage() {
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [brandId, setBrandId] = useState("");
  const [guidelineId, setGuidelineId] = useState("");
  const [contentType, setContentType] = useState("social_caption");
  const [contentText, setContentText] = useState("Our new serum is the #1 cure for acne — guaranteed results in 7 days!");
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");

  const activeMembership = useMemo(() => memberships.find((membership) => membership.workspaces?.id === workspaceId), [memberships, workspaceId]);
  const canAudit = activeMembership?.role === "administrator" || activeMembership?.role === "editor";
  const approvedGuidelines = guidelines.filter((guideline) => guideline.status === "approved");

  async function loadWorkspaces() {
    const response = await apiFetch<{ data: WorkspaceMembership[] }>("/workspaces");
    setMemberships(response.data); setWorkspaceId((current) => current || response.data[0]?.workspaces?.id || "");
  }
  async function loadBrands(id = workspaceId) {
    if (!id) return;
    const response = await apiFetch<{ data: Brand[] }>(`/brands?workspaceId=${encodeURIComponent(id)}`);
    setBrands(response.data); setBrandId((current) => response.data.some((brand) => brand.id === current) ? current : response.data[0]?.id || "");
  }
  async function loadGuidelines(id = brandId) {
    if (!id) { setGuidelines([]); return; }
    const response = await apiFetch<{ data: { guidelines: Guideline[] } }>(`/brands/${id}`);
    setGuidelines(response.data.guidelines ?? []); setGuidelineId((current) => response.data.guidelines.some((guideline) => guideline.id === current && guideline.status === "approved") ? current : response.data.guidelines.find((guideline) => guideline.status === "approved")?.id || "");
  }
  async function loadAudits(id = workspaceId) {
    if (!id) return;
    const response = await apiFetch<{ data: Audit[] }>(`/audits?workspaceId=${encodeURIComponent(id)}`); setAudits(response.data);
  }

  useEffect(() => { void loadWorkspaces().catch((error) => setNotice(error.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { void loadBrands().catch((error) => setNotice(error.message)); void loadAudits().catch((error) => setNotice(error.message)); }, [workspaceId]);
  useEffect(() => { void loadGuidelines().catch((error) => setNotice(error.message)); }, [brandId]);

  async function runAudit() {
    setRunning(true); setNotice("");
    try {
      const response = await apiFetch<{ data: Audit }>("/audits", { method: "POST", body: JSON.stringify({ workspaceId, brandId, guidelineVersionId: guidelineId, contentType, contentText }) });
      setSelectedAudit(response.data); await loadAudits();
    } catch (error) { setNotice(error instanceof Error ? error.message : "The audit could not be completed."); } finally { setRunning(false); }
  }

  async function reviewFinding(finding: Finding, decision: "accepted" | "dismissed" | "requires_review") {
    if (!selectedAudit) return;
    try { await apiFetch(`/audits/${selectedAudit.id}/reviews`, { method: "POST", body: JSON.stringify({ findingId: finding.id, decision }) }); setSelectedAudit({ ...selectedAudit, findings: selectedAudit.findings?.map((item) => item.id === finding.id ? { ...item, review_status: decision } : item) }); setNotice(`Finding marked ${decision.replace("_", " ")}.`); } catch (error) { setNotice(error instanceof Error ? error.message : "The finding review could not be saved."); }
  }

  if (loading && memberships.length === 0 && !notice) return <div className="grid min-h-[50vh] place-items-center text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} />Loading audit context...</div>;

  return <>
    <PageHeader eyebrow="Evidence-led review" title="Audit content" body="Submit copy against an approved guideline version. The server persists the exact version, score, evidence, and reviewer decision." action={<Button variant="secondary" onClick={() => void loadAudits()}><RefreshCw size={15} />Refresh history</Button>} />
    {notice && <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">{notice}</div>}
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-panel"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace context</p><p className="mt-1 text-sm font-semibold text-slate-900">{activeMembership?.workspaces?.name || "No workspace selected"}</p></div>{memberships.length > 0 && <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} className={inputClass + " min-h-10 max-w-xs"}>{memberships.map((membership) => membership.workspaces && <option key={membership.workspaces.id} value={membership.workspaces.id}>{membership.workspaces.name}</option>)}</select>}</div>
    {!canAudit && memberships.length > 0 && <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><ShieldCheck size={17} />You have viewer access. Ask a workspace administrator or editor to run audits.</div>}
    {memberships.length === 0 && <Card className="mb-6 p-8"><div className="flex items-start gap-4"><div className="grid size-11 place-items-center rounded-2xl bg-violet-50 text-violet-600"><ClipboardCheck size={20} /></div><div><h2 className="font-display text-xl font-bold text-slate-950">Add a workspace and approved guideline first</h2><p className="mt-2 text-sm leading-6 text-slate-500">The audit engine refuses to run without a workspace-scoped brand and an approved guideline version.</p></div></div></Card>}
    {memberships.length > 0 && <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"><Card className="p-6"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><ClipboardCheck size={19} /></div><div><h2 className="font-display text-xl font-bold text-slate-950">New audit</h2><p className="text-sm text-slate-500">Score a message before it reaches a campaign.</p></div></div><div className="mt-6 grid gap-4"><label className="grid gap-2 text-sm font-semibold text-slate-700"><span>Brand</span><select className={inputClass} value={brandId} onChange={(event) => setBrandId(event.target.value)}><option value="">Select a brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold text-slate-700"><span>Approved guideline version</span><select className={inputClass} value={guidelineId} onChange={(event) => setGuidelineId(event.target.value)}><option value="">Select an approved version</option>{approvedGuidelines.map((guideline) => <option key={guideline.id} value={guideline.id}>v{guideline.version_number} · {guideline.title}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold text-slate-700"><span>Content type</span><select className={inputClass} value={contentType} onChange={(event) => setContentType(event.target.value)}><option value="social_caption">Social caption</option><option value="email">Email</option><option value="landing_page">Landing page</option><option value="text">Plain text</option></select></label><label className="grid gap-2 text-sm font-semibold text-slate-700"><span>Content to review</span><textarea className={inputClass + " py-3"} rows={8} value={contentText} onChange={(event) => setContentText(event.target.value)} /></label><Button onClick={() => void runAudit()} disabled={!canAudit || !brandId || !guidelineId || contentText.length < 5 || running}>{running ? <Loader2 className="animate-spin" size={16} /> : <ClipboardCheck size={16} />}Run audit</Button><p className="text-xs leading-5 text-slate-400">This environment uses the deterministic demo scorer; live Gemini auditing is not enabled in this slice. It never presents fixture output as live model output.</p></div></Card><div className="grid gap-6"><Card className="min-h-[330px] p-6">{selectedAudit ? <><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Badge tone={scoreTone(Number(selectedAudit.overall_score ?? 0))}>{selectedAudit.risk_class || "review"}</Badge>{selectedAudit.is_demo && <Badge tone="amber">demo analysis</Badge>}</div><h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.05em] text-slate-950">{selectedAudit.overall_score ?? "—"}<span className="text-lg text-slate-400"> / 100</span></h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{selectedAudit.summary}</p></div><div className="grid size-20 place-items-center rounded-full border-[10px] border-violet-100 text-center"><span className="text-xl font-bold text-violet-600">{selectedAudit.overall_score ?? 0}</span></div></div><div className="mt-6 space-y-3">{selectedAudit.findings?.length ? selectedAudit.findings.map((finding) => <div key={finding.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><Badge tone={severityTone(finding.severity)}>{finding.severity}</Badge><span className="text-sm font-semibold text-slate-950">{finding.description}</span>{finding.review_status !== "pending" && <Badge tone="green">{finding.review_status.replace("_", " ")}</Badge>}</div><p className="mt-2 text-sm leading-6 text-slate-600">{finding.explanation}</p></div><AlertTriangle className="shrink-0 text-amber-500" size={18} /></div>{finding.evidence && <div className="mt-3 rounded-xl bg-slate-950 px-3 py-2 text-xs leading-5 text-slate-200">“{finding.evidence}”</div>}<div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">Suggested correction</p><p className="mt-1 leading-6">{finding.recommended_correction}</p></div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => void reviewFinding(finding, "accepted")}><Check size={14} />Accept</Button><Button size="sm" variant="ghost" onClick={() => void reviewFinding(finding, "dismissed")}><X size={14} />Dismiss</Button><Button size="sm" variant="ghost" onClick={() => void reviewFinding(finding, "requires_review")}>Needs review</Button></div></div>) : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"><div className="flex items-center gap-2 font-semibold"><Check size={17} />No findings triggered</div><p className="mt-2 leading-6">The content cleared the configured rules in this demo analysis. Review the evidence state before publishing.</p></div>}</div></> : <div className="grid min-h-[300px] place-items-center text-center"><div><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><FileText size={22} /></div><h2 className="mt-4 font-display text-xl font-bold text-slate-950">Your audit result will appear here</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Choose an approved guideline, submit copy, and the server will calculate the score and persist each finding with its source reference.</p></div></div>}</Card><Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">History</p><h2 className="mt-1 font-display text-xl font-bold text-slate-950">Recent audits</h2></div><Badge tone="neutral">{audits.length}</Badge></div><div className="mt-4 divide-y divide-slate-100">{audits.length ? audits.slice(0, 6).map((audit) => <button key={audit.id} onClick={() => { void apiFetch<{ data: Audit }>(`/audits/${audit.id}`).then((response) => setSelectedAudit(response.data)); }} className="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{audit.brands?.name || "Brand audit"}</p><p className="mt-1 truncate text-xs text-slate-500">{audit.content_text}</p></div><div className="text-right"><p className="text-sm font-bold text-slate-900">{audit.overall_score ?? "—"}</p><p className="text-[11px] text-slate-400">{new Date(audit.created_at).toLocaleDateString()}</p></div></button>) : <div className="py-6 text-sm text-slate-500">No audits saved in this workspace yet.</div>}</div></Card></div></div>}
  </>;
}
