import { ShieldCheck } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-violet-500 text-white shadow-glow"><ShieldCheck size={20} strokeWidth={2.3} /></span>{!compact && <span className="font-display text-[15px] font-bold tracking-tight text-slate-950">BrandSentinel <span className="text-violet-500">AI</span></span>}</div>;
}
