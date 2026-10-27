import { Sparkles } from "lucide-react";
import { Badge } from "./ui";

export function ModeBanner({ demoMode }: { demoMode: boolean }) {
  if (!demoMode) return <Badge tone="green">Live mode</Badge>;
  return <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"><Sparkles size={14} /><span><strong>Demo data:</strong> deterministic fixtures are shown until Supabase browser credentials are configured.</span></div>;
}
