import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { getServiceClient, getUserScopedClient } from "../lib/supabase.js";

export const rewardsRouter = Router();

rewardsRouter.get("/rewards", requireAuth, async (req: AuthenticatedRequest, res) => {
  const client = req.accessToken ? getUserScopedClient(req.accessToken) : null;
  if (!client || !req.user?.id) { res.status(!client ? 503 : 401).json({ error: { code: !client ? "REWARDS_UNAVAILABLE" : "AUTH_REQUIRED", message: !client ? "Rewards service is not configured." : "A valid session is required." } }); return; }
  const [{ data: account }, { data: transactions }, { data: badges }, { data: leaderboardRows }] = await Promise.all([
    client.from("reward_accounts").select("balance, updated_at").eq("user_id", req.user.id).maybeSingle(),
    client.from("reward_transactions").select("id, points, source_type, description, created_at").eq("user_id", req.user.id).order("created_at", { ascending: false }).limit(30),
    client.from("user_badges").select("awarded_at, reward_badges(code, name, description, points_threshold)").eq("user_id", req.user.id).order("awarded_at", { ascending: false }).limit(20),
    Promise.resolve({ data: null }),
  ]);
  const service = getServiceClient();
  const { data: leaderboard } = service ? await service.from("reward_accounts").select("balance").order("balance", { ascending: false }).limit(10) : { data: null };
  res.json({ data: { balance: account?.balance ?? 0, accountUpdatedAt: account?.updated_at ?? null, transactions: transactions ?? [], badges: badges ?? [], leaderboard: (leaderboard ?? []).map((row, index) => ({ rank: index + 1, label: `Member ${index + 1}`, balance: row.balance })), rules: [{ action: "Publish a constructive post", points: 15 }, { action: "Add a constructive comment", points: 3 }, { action: "Submit an eligible survey response", points: 10 }], nonMonetary: true } });
});
