import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isDemoMode } from "../../lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (name: string, email: string, password: string) => Promise<{ error?: string; needsVerification?: boolean }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const DEMO_STORAGE_KEY = "brandsentinel-demo-session";
const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_EMAIL = "demo@brandsentinel.ai";

function createDemoSession(): Session {
  return {
    access_token: "demo-token",
    refresh_token: "demo-refresh-token",
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    token_type: "bearer",
    user: {
      id: DEMO_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: DEMO_EMAIL,
      email_confirmed_at: new Date().toISOString(),
      phone: "",
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: "demo", providers: ["demo"] },
      user_metadata: { full_name: "Demo owner", requested_role: "business_owner" },
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_anonymous: false,
    },
  } as Session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
      const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
      setSession(stored ? createDemoSession() : null);
      setLoading(false);
      return;
    }
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    demoMode: isDemoMode,
    async signIn(email, password) {
      if (isDemoMode) {
        const next = createDemoSession();
        window.localStorage.setItem(DEMO_STORAGE_KEY, "active");
        setSession(next);
        return {};
      }
      if (!supabase) return { error: "Authentication is not configured in this environment yet. Demo mode is active." };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    },
    async signUp(name, email, password) {
      if (isDemoMode) {
        const next = createDemoSession();
        next.user.user_metadata.full_name = name || "Demo owner";
        window.localStorage.setItem(DEMO_STORAGE_KEY, "active");
        setSession(next);
        return {};
      }
      if (!supabase) return { error: "Authentication is not configured in this environment yet. Add the Supabase browser-safe variables to enable registration." };
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name, requested_role: "business_owner" } } });
      return error ? { error: error.message } : { needsVerification: !data.session };
    },
    async resetPassword(email) {
      if (isDemoMode) return { error: "Password recovery is not used in demo mode. Enter the demo workspace instead." };
      if (!supabase) return { error: "Password recovery is unavailable while demo mode is active." };
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
      return error ? { error: error.message } : {};
    },
    async signOut() { window.localStorage.removeItem(DEMO_STORAGE_KEY); if (supabase && !isDemoMode) await supabase.auth.signOut(); setSession(null); },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
