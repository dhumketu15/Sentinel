import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./features/auth/AuthProvider";
import { AppLayout } from "./layouts/AppLayout";
import { PublicLayout } from "./layouts/PublicLayout";
import { AuthPage } from "./pages/AuthPage";
import { AuditsPage } from "./pages/AuditsPage";
import { BrandsPage } from "./pages/BrandsPage";
import { LandingPage } from "./pages/LandingPage";
import { ModulePage } from "./pages/ModulePage";
import { OverviewPage } from "./pages/OverviewPage";
import { PublicInfoPage } from "./pages/PublicInfoPage";

function ProtectedRoute() { const { session, loading } = useAuth(); const location = useLocation(); if (loading) return <div className="grid min-h-screen place-items-center bg-[#f8faff] text-sm text-slate-500">Loading secure workspace...</div>; return session ? <AppLayout /> : <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />; }

export function App() { return <Routes><Route element={<PublicLayout />}><Route path="/" element={<LandingPage />} /><Route path="/features" element={<PublicInfoPage />} /><Route path="/how-it-works" element={<PublicInfoPage />} /><Route path="/community" element={<PublicInfoPage />} /><Route path="/brand-qa" element={<PublicInfoPage />} /><Route path="/login" element={<AuthPage />} /><Route path="/register" element={<AuthPage />} /><Route path="/forgot-password" element={<AuthPage />} /></Route><Route element={<ProtectedRoute />}><Route path="/app/brands" element={<BrandsPage />} /><Route path="/app/audits" element={<AuditsPage />} /><Route path="/app/:section" element={<ModulePage />} /><Route path="/app/overview" element={<OverviewPage />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes>; }
