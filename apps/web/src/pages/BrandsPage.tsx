import { useEffect, useMemo, useState } from "react";
import { Check, FileText, Loader2, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Badge, Button, Card, Field } from "../components/ui";
import { apiFetch } from "../lib/api";

type WorkspaceMembership = { role: string; workspaces: { id: string; name: string; slug: string } | null };
type Brand = { id: string; workspace_id: string; name: string; description?: string | null; industry?: string | null; website?: string | null; preferred_tone?: string | null; prohibited_phrases?: string[]; updated_at: string };
type Guideline = { id: string; version_number: number; status: string; title: string; approved_at?: string | null; brand_rules?: Array<{ id: string; title: string; category: string; severity: string; compliant_examples?: string[]; noncompliant_examples?: string[] }> };
type BrandDetail = Brand & { guidelines: Guideline[] };

const inputClass = "min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-50";

export function BrandsPage() {
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [detail, setDetail] = useState<BrandDetail | null>(null);
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [showGuidelineForm, setShowGuidelineForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [workspaceForm, setWorkspaceForm] = useState({ name: "", slug: "" });
  const [brandForm, setBrandForm] = useState({ name: "", industry: "", preferredTone: "", prohibitedPhrases: "" });
  const [guidelineForm, setGuidelineForm] = useState({ title: "", ruleTitle: "", category: "Claims & evidence", severity: "high", evaluationInstructions: "Avoid absolute or medical efficacy claims unless substantiated.", compliantExample: "Use specific, supportable language.", noncompliantExample: "#1 cure with guaranteed results" });

  const activeMembership = useMemo(() => memberships.find((membership) => membership.workspaces?.id === workspaceId), [memberships, workspaceId]);
  const canEdit = activeMembership?.role === "administrator" || activeMembership?.role === "editor";

  async function loadWorkspaces() {
    const response = await apiFetch<{ data: WorkspaceMembership[] }>("/workspaces");
    setMemberships(response.data);
    const first = response.data[0]?.workspaces?.id ?? "";
    setWorkspaceId((current) => current || first);
  }

  async function loadBrands(id = workspaceId) {
    if (!id) return;
    const response = await apiFetch<{ data: Brand[] }>(`/brands?workspaceId=${encodeURIComponent(id)}`);
    setBrands(response.data);
    setSelectedBrandId((current) => response.data.some((brand) => brand.id === current) ? current : response.data[0]?.id ?? "");
  }

  async function loadDetail(id = selectedBrandId) {
    if (!id) { setDetail(null); return; }
    const response = await apiFetch<{ data: BrandDetail }>(`/brands/${id}`);
    setDetail(response.data);
  }

  useEffect(() => { void loadWorkspaces().catch((error) => setNotice(error.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { void loadBrands().catch((error) => setNotice(error.message)); }, [workspaceId]);
  useEffect(() => { void loadDetail().catch((error) => setNotice(error.message)); }, [selectedBrandId]);

  async function createWorkspace() {
    setSaving(true); setNotice("");
    try {
      const response = await apiFetch<{ data: { id: string } }>("/workspaces", { method: "POST", body: JSON.stringify(workspaceForm) });
      setWorkspaceForm({ name: "", slug: "" });
      await loadWorkspaces();
      setWorkspaceId(response.data.id);
      setNotice("Workspace created. Add your first brand profile below.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Workspace could not be created."); } finally { setSaving(false); }
  }

  async function createBrand() {
    if (!workspaceId) return;
    setSaving(true); setNotice("");
    try {
      const response = await apiFetch<{ data: Brand }>("/brands", { method: "POST", body: JSON.stringify({ workspaceId, name: brandForm.name, industry: brandForm.industry || undefined, preferredTone: brandForm.preferredTone || undefined, prohibitedPhrases: brandForm.prohibitedPhrases.split("\n").map((value) => value.trim()).filter(Boolean) }) });
      setBrands((current) => [response.data, ...current]); setSelectedBrandId(response.data.id); setBrandForm({ name: "", industry: "", preferredTone: "", prohibitedPhrases: "" }); setShowBrandForm(false); setNotice("Brand profile created. Add a guideline version to make it auditable.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Brand profile could not be created."); } finally { setSaving(false); }
  }

  async function createGuideline() {
    if (!workspaceId || !selectedBrandId) return;
    setSaving(true); setNotice("");
    try {
      await apiFetch(`/brands/${selectedBrandId}/guidelines`, { method: "POST", body: JSON.stringify({ workspaceId, title: guidelineForm.title, rules: [{ ruleKey: "claims-evidence", title: guidelineForm.ruleTitle, description: "Keep claims specific, supportable, and aligned with the approved brand voice.", category: guidelineForm.category, severity: guidelineForm.severity, evaluationInstructions: guidelineForm.evaluationInstructions, compliantExamples: [guidelineForm.compliantExample], noncompliantExamples: [guidelineForm.noncompliantExample], mandatory: true }] }) });
      setShowGuidelineForm(false); setGuidelineForm({ title: "", ruleTitle: "", category: "Claims & evidence", severity: "high", evaluationInstructions: "Avoid absolute or medical efficacy claims unless substantiated.", compliantExample: "Use specific, supportable language.", noncompliantExample: "#1 cure with guaranteed results" }); await loadDetail(); setNotice("Guideline version saved as pending review.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Guideline could not be created."); } finally { setSaving(false); }
  }

  async function approveGuideline(id: string) {
    setSaving(true); setNotice("");
    try { await apiFetch(`/guidelines/${id}/approve`, { method: "POST", body: JSON.stringify({}) }); await loadDetail(); setNotice("Guideline approved. Audits can now use this exact version."); } catch (error) { setNotice(error instanceof Error ? error.message : "Guideline could not be approved."); } finally { setSaving(false); }
  }

  if (loading && memberships.length === 0 && !notice) return <div className="grid min-h-[50vh] place-items-center text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} />Loading your workspaces...</div>;

  return <>
    <PageHeader eyebrow="Brand governance" title="Brands & guidelines" body="Create the source of truth your team will audit against. Every version stays attached to its audit history." action={canEdit ? <Button onClick={() => setShowBrandForm((value) => !value)}><Plus size={16} />Add brand</Button> : undefined} />
    {notice && <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">{notice}</div>}
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-panel"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace context</p><p className="mt-1 text-sm font-semibold text-slate-900">{activeMembership?.workspaces?.name ?? "Create a workspace to begin"}</p></div>{memberships.length > 0 && <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} className={inputClass + " min-h-10 max-w-xs"}>{memberships.map((membership) => membership.workspaces && <option key={membership.workspaces.id} value={membership.workspaces.id}>{membership.workspaces.name}</option>)}</select>}</div>
    {memberships.length === 0 && <Card className="mb-6 p-6"><div className="flex items-start gap-4"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-600"><ShieldCheck size={20} /></div><div className="min-w-0 flex-1"><h2 className="font-display text-xl font-bold text-slate-950">Create your first workspace</h2><p className="mt-2 text-sm leading-6 text-slate-500">Workspace records are tenant-scoped from the start. Use a URL-safe slug so your team can recognize it later.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Workspace name" value={workspaceForm.name} onChange={(event) => setWorkspaceForm({ ...workspaceForm, name: event.target.value })} placeholder="Clearglow studio" /><Field label="Workspace slug" value={workspaceForm.slug} onChange={(event) => setWorkspaceForm({ ...workspaceForm, slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })} placeholder="clearglow-studio" /></div><Button className="mt-4" onClick={() => void createWorkspace()} disabled={saving || workspaceForm.name.length < 2 || workspaceForm.slug.length < 2}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}Create workspace</Button></div></div></Card>}
    {showBrandForm && memberships.length > 0 && <Card className="mb-6 p-6"><div className="flex items-center justify-between"><div><Badge tone="violet">New brand profile</Badge><h2 className="mt-3 font-display text-xl font-bold text-slate-950">Give your team a shared source of truth.</h2></div><Sparkles className="text-violet-500" size={20} /></div><div className="mt-5 grid gap-4 md:grid-cols-3"><Field label="Brand name" value={brandForm.name} onChange={(event) => setBrandForm({ ...brandForm, name: event.target.value })} placeholder="Clearglow" /><Field label="Industry" value={brandForm.industry} onChange={(event) => setBrandForm({ ...brandForm, industry: event.target.value })} placeholder="Skincare" /><Field label="Preferred tone" value={brandForm.preferredTone} onChange={(event) => setBrandForm({ ...brandForm, preferredTone: event.target.value })} placeholder="Clear, reassuring, specific" /></div><label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700"><span>Prohibited phrases <span className="font-normal text-slate-400">(one per line)</span></span><textarea className={inputClass + " py-3"} rows={3} value={brandForm.prohibitedPhrases} onChange={(event) => setBrandForm({ ...brandForm, prohibitedPhrases: event.target.value })} placeholder="miracle\nguaranteed results" /></label><div className="mt-4 flex gap-3"><Button onClick={() => void createBrand()} disabled={saving || brandForm.name.length < 2}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}Save profile</Button><Button variant="ghost" onClick={() => setShowBrandForm(false)}>Cancel</Button></div></Card>}
    {memberships.length > 0 && brands.length === 0 && !showBrandForm && <Card className="mb-6 flex flex-col items-start gap-4 p-8"><div className="grid size-12 place-items-center rounded-2xl bg-violet-50 text-violet-600"><FileText size={22} /></div><div><h2 className="font-display text-2xl font-bold text-slate-950">No brands yet</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Start with one brand profile, then add an approved guideline version so every audit has a defensible source.</p></div><Button onClick={() => setShowBrandForm(true)}><Plus size={16} />Create a brand profile</Button></Card>}
    {brands.length > 0 && <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]"><Card className="p-3"><div className="flex items-center justify-between px-3 pb-3 pt-2"><h2 className="font-display text-lg font-bold text-slate-950">Brand profiles</h2><Badge tone="violet">{brands.length} active</Badge></div><div className="grid gap-2">{brands.map((brand) => <button key={brand.id} onClick={() => setSelectedBrandId(brand.id)} className={`rounded-xl border p-4 text-left transition ${brand.id === selectedBrandId ? "border-violet-300 bg-violet-50/70" : "border-slate-200 bg-white hover:border-violet-200"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{brand.name}</p><p className="mt-1 text-xs text-slate-500">{brand.industry || "Industry not set"}</p></div><span className="text-violet-500">→</span></div><p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{brand.preferred_tone || "Add a preferred tone to keep recommendations consistent."}</p></button>)}</div></Card><Card className="p-6">{detail ? <><div className="flex flex-wrap items-start justify-between gap-4"><div><Badge tone="green">Profile active</Badge><h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.04em] text-slate-950">{detail.name}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{detail.description || "A workspace-scoped brand profile ready for a versioned guideline."}</p></div>{canEdit && <Button variant="secondary" onClick={() => setShowGuidelineForm((value) => !value)}><Plus size={15} />Add guideline version</Button>}</div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Industry</p><p className="mt-1 text-sm font-semibold text-slate-900">{detail.industry || "Not set"}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Preferred tone</p><p className="mt-1 text-sm font-semibold text-slate-900">{detail.preferred_tone || "Not set"}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Prohibited phrases</p><p className="mt-1 text-sm font-semibold text-slate-900">{detail.prohibited_phrases?.length ?? 0} configured</p></div></div>{showGuidelineForm && <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/60 p-5"><Badge tone="violet">Versioned guideline</Badge><h3 className="mt-3 font-display text-lg font-bold text-slate-950">Capture the rule your reviewers need.</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="Version title" value={guidelineForm.title} onChange={(event) => setGuidelineForm({ ...guidelineForm, title: event.target.value })} placeholder="Clearglow claims standard" /><Field label="Rule title" value={guidelineForm.ruleTitle} onChange={(event) => setGuidelineForm({ ...guidelineForm, ruleTitle: event.target.value })} placeholder="Claims must be supportable" /><Field label="Category" value={guidelineForm.category} onChange={(event) => setGuidelineForm({ ...guidelineForm, category: event.target.value })} /><label className="grid gap-2 text-sm font-semibold text-slate-700"><span>Severity</span><select className={inputClass} value={guidelineForm.severity} onChange={(event) => setGuidelineForm({ ...guidelineForm, severity: event.target.value })}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label></div><label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700"><span>Evaluation instruction</span><textarea className={inputClass + " py-3"} rows={2} value={guidelineForm.evaluationInstructions} onChange={(event) => setGuidelineForm({ ...guidelineForm, evaluationInstructions: event.target.value })} /></label><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="Compliant example" value={guidelineForm.compliantExample} onChange={(event) => setGuidelineForm({ ...guidelineForm, compliantExample: event.target.value })} /><Field label="Non-compliant example" value={guidelineForm.noncompliantExample} onChange={(event) => setGuidelineForm({ ...guidelineForm, noncompliantExample: event.target.value })} /></div><div className="mt-4 flex gap-3"><Button onClick={() => void createGuideline()} disabled={saving || guidelineForm.title.length < 2 || guidelineForm.ruleTitle.length < 2}>{saving ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}Save pending version</Button><Button variant="ghost" onClick={() => setShowGuidelineForm(false)}>Cancel</Button></div></div>}<div className="mt-8"><div className="flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Guideline history</p><h3 className="mt-1 font-display text-lg font-bold text-slate-950">Exact versions attached to future audits</h3></div><Badge tone="neutral">{detail.guidelines?.length ?? 0} versions</Badge></div><div className="mt-4 grid gap-3">{detail.guidelines?.length ? detail.guidelines.map((guideline) => <div key={guideline.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-semibold text-slate-950">v{guideline.version_number} · {guideline.title}</span><Badge tone={guideline.status === "approved" ? "green" : guideline.status === "pending_review" ? "amber" : "neutral"}>{guideline.status.replace("_", " ")}</Badge></div><p className="mt-1 text-xs text-slate-500">{guideline.brand_rules?.length ?? 0} rule(s) · {guideline.approved_at ? `Approved ${new Date(guideline.approved_at).toLocaleDateString()}` : "Awaiting reviewer decision"}</p></div>{canEdit && guideline.status !== "approved" && <Button size="sm" variant="secondary" onClick={() => void approveGuideline(guideline.id)} disabled={saving}><Check size={14} />Approve</Button>}</div></div>) : <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No guideline versions yet. Add one to unlock audits.</div>}</div></div></> : <div className="grid min-h-[320px] place-items-center text-center text-sm text-slate-500">Select a brand profile to review its guideline history.</div>}</Card></div>}
  </>;
}
