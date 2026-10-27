import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, body, action }: { eyebrow: string; title: string; body: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col gap-5 border-b border-slate-200 pb-7 md:flex-row md:items-end md:justify-between"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-600">{eyebrow}</p><h1 className="font-display text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{body}</p></div>{action}</div>;
}
