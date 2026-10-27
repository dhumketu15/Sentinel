import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabaseConfig, hasUserScopedSupabaseConfig } from "../config/env.js";

let adminClient: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient | null {
  if (!hasSupabaseConfig || !env.SUPABASE_URL) return null;
  if (!adminClient) {
    adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY ?? env.SUPABASE_KEY ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

export async function getUserFromAccessToken(accessToken: string) {
  const client = getAdminClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

export function getUserScopedClient(accessToken: string): SupabaseClient | null {
  if (!hasUserScopedSupabaseConfig || !env.SUPABASE_URL) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY ?? env.SUPABASE_PUBLISHABLE_KEY ?? "", {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
