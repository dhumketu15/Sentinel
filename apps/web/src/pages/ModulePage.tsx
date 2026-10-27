import { ArrowRight, Construction, Sparkles } from "lucide-react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/PageHeader";
import { Badge, Button, Card } from "../components/ui";

export function ModulePage() {
  const { section = "overview" } = useParams();
  const { t } = useTranslation();
  const title = t(`nav.${section}`, { defaultValue: "Workspace module" });
  return <><PageHeader eyebrow="Foundation slice" title={title} body="This route is wired into the protected workspace shell. The next vertical slice will connect it to real Supabase records and feature-specific workflows." action={<Button variant="secondary"><Sparkles size={15} />View roadmap</Button>} /><Card className="flex flex-col items-start gap-5 p-8 sm:p-12"><div className="grid size-12 place-items-center rounded-2xl bg-violet-50 text-violet-600"><Construction size={22} /></div><div><Badge tone="violet">Phase 2 module</Badge><h2 className="mt-4 font-display text-2xl font-bold tracking-[-0.04em] text-slate-950">The route is ready for the next evidence-led workflow.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">Brand profiles, versioned guidelines, reports, analytics, surveys, community, rewards, and the AI assistant are being built as real API-backed vertical slices—not static screens. This explicit state prevents a button that appears to work while data is missing.</p></div><Button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Review this phase <ArrowRight size={15} /></Button></Card></>;
}
