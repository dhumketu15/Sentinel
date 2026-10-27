import { Link, Outlet, useLocation } from "react-router-dom";
import { Languages, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrandMark } from "../components/BrandMark";
import { Button } from "../components/ui";

export function PublicLayout() {
  const { i18n, t } = useTranslation();
  const location = useLocation();
  const setLanguage = (language: "en" | "hi") => void i18n.changeLanguage(language);
  return <div className="min-h-screen bg-[#f8faff] text-slate-900">
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f8faff]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-5 px-5 lg:px-8">
        <Link to="/" aria-label="BrandSentinel AI home"><BrandMark /></Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-slate-500 md:flex">
          <Link className="transition hover:text-slate-950" to="/features">Features</Link>
          <Link className="transition hover:text-slate-950" to="/how-it-works">How it works</Link>
          <Link className="transition hover:text-slate-950" to="/community">Community</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 sm:flex" aria-label="Language selector">
            <button onClick={() => setLanguage("en")} className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${i18n.language === "en" ? "bg-slate-950 text-white" : "text-slate-400 hover:text-slate-700"}`}>EN</button>
            <button onClick={() => setLanguage("hi")} className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${i18n.language === "hi" ? "bg-slate-950 text-white" : "text-slate-400 hover:text-slate-700"}`}><Languages size={13} /></button>
          </div>
          <Link className="hidden sm:block" to="/login"><Button variant="ghost" size="sm">{t("common.signIn")}</Button></Link>
          <Link to="/register"><Button size="sm">{t("common.createAccount")} <ArrowUpRight size={14} /></Button></Link>
        </div>
      </div>
    </header>
    <Outlet context={{ location }} />
  </div>;
}
