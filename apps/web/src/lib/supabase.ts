import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const demoFlag = (import.meta.env.VITE_DEMO_MODE as string | undefined) !== "false";

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
export const isDemoMode = demoFlag || !supabase;
