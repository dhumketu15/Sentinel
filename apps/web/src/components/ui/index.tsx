import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg" }) {
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50", variant === "primary" && "bg-violet-500 text-white shadow-glow hover:bg-violet-400", variant === "secondary" && "border border-slate-200 bg-white text-slate-900 hover:border-violet-300 hover:text-violet-700", variant === "ghost" && "text-slate-500 hover:bg-slate-100 hover:text-slate-900", variant === "danger" && "bg-red-50 text-red-700 hover:bg-red-100", size === "sm" && "min-h-9 px-3 text-xs", size === "md" && "min-h-11 px-4 text-sm", size === "lg" && "min-h-12 px-5 text-sm", className)} {...props} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-2xl border border-slate-200 bg-white shadow-panel", className)}>{children}</section>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "violet" | "green" | "amber" | "red" }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]", tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-500", tone === "violet" && "border-violet-200 bg-violet-50 text-violet-700", tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700", tone === "amber" && "border-amber-200 bg-amber-50 text-amber-700", tone === "red" && "border-red-200 bg-red-50 text-red-700")}>{children}</span>;
}

export function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className="grid gap-2 text-sm font-semibold text-slate-700"><span>{label}</span><input className="min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-50" {...props} />{hint && <span className="text-xs font-normal text-slate-400">{hint}</span>}</label>;
}
