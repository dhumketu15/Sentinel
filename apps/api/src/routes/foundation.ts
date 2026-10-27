import { Router } from "express";
import { env, hasGeminiConfig, hasSupabaseConfig } from "../config/env.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { getUserScopedClient } from "../lib/supabase.js";
import { createWorkspaceSchema, updateProfileSchema, updateWorkspaceSchema, workspaceIdParamSchema } from "../schemas/foundation.js";

export const foundationRouter = Router();

foundationRouter.get("/health", (_req, res) => {
  res.json({ data: { status: "ok", service: "brandsentinel-api", environment: env.NODE_ENV } });
});

foundationRouter.get("/readiness", (_req, res) => {
  res.json({ data: { status: "ready", integrations: { supabase: hasSupabaseConfig, gemini: hasGeminiConfig, mode: hasGeminiConfig ? "live" : "demo" } } });
});

function userClient(req: AuthenticatedRequest) {
  return req.accessToken ? getUserScopedClient(req.accessToken) : null;
}

foundationRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const client = userClient(req);
  if (!client || !req.user?.id) {
    res.status(503).json({ error: { code: "SUPABASE_UNAVAILABLE", message: "Profile service is not configured." } });
    return;
  }
  const { data: profile, error } = await client.from("profiles").select("id, full_name, email, role, preferred_language").eq("id", req.user.id).maybeSingle();
  if (error) {
    res.status(500).json({ error: { code: "PROFILE_LOOKUP_FAILED", message: "Unable to load the current profile." } });
    return;
  }
  res.json({ data: { user: req.user, profile } });
});

foundationRouter.patch("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "INVALID_PROFILE_UPDATE", message: parsed.error.issues[0]?.message ?? "Provide a supported profile field." } });
    return;
  }
  const client = userClient(req);
  if (!client || !req.user?.id) {
    res.status(503).json({ error: { code: "SUPABASE_UNAVAILABLE", message: "Profile service is not configured." } });
    return;
  }
  const { data, error } = await client.from("profiles").update({ full_name: parsed.data.fullName, preferred_language: parsed.data.preferredLanguage }).eq("id", req.user.id).select("id, full_name, email, role, preferred_language").single();
  if (error) {
    res.status(500).json({ error: { code: "PROFILE_UPDATE_FAILED", message: "Unable to update the current profile." } });
    return;
  }
  res.json({ data });
});

foundationRouter.get("/me/notifications", requireAuth, async (req: AuthenticatedRequest, res) => {
  const client = userClient(req);
  if (!client || !req.user?.id) {
    res.status(503).json({ error: { code: "SUPABASE_UNAVAILABLE", message: "Notification service is not configured." } });
    return;
  }
  const { data, error } = await client.from("notifications").select("id, title, body, read_at, created_at").eq("user_id", req.user.id).order("created_at", { ascending: false }).limit(50);
  if (error) {
    res.status(500).json({ error: { code: "NOTIFICATION_LOOKUP_FAILED", message: "Unable to load notifications." } });
    return;
  }
  res.json({ data: data ?? [] });
});

foundationRouter.get("/workspaces", requireAuth, async (req: AuthenticatedRequest, res) => {
  const client = userClient(req);
  if (!client || !req.user?.id) {
    res.status(503).json({ error: { code: "SUPABASE_UNAVAILABLE", message: "Workspace service is not configured." } });
    return;
  }
  const { data, error } = await client.from("workspace_members").select("role, workspaces(id, name, slug, owner_id, created_at)").eq("user_id", req.user.id);
  if (error) {
    res.status(500).json({ error: { code: "WORKSPACE_LOOKUP_FAILED", message: "Unable to load workspaces." } });
    return;
  }
  res.json({ data: data ?? [] });
});

foundationRouter.post("/workspaces", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success || !req.user?.id) {
    res.status(400).json({ error: { code: "INVALID_WORKSPACE", message: parsed.success ? "A valid session is required." : parsed.error.issues[0]?.message ?? "Workspace details are invalid." } });
    return;
  }
  const client = userClient(req);
  if (!client) {
    res.status(503).json({ error: { code: "SUPABASE_UNAVAILABLE", message: "Workspace service is not configured." } });
    return;
  }
  const { data, error } = await client.from("workspaces").insert({ name: parsed.data.name, slug: parsed.data.slug, owner_id: req.user.id }).select("id, name, slug, owner_id, created_at").single();
  if (error) {
    const duplicate = error.code === "23505";
    res.status(duplicate ? 409 : 500).json({ error: { code: duplicate ? "WORKSPACE_SLUG_EXISTS" : "WORKSPACE_CREATE_FAILED", message: duplicate ? "Choose a different workspace slug." : "Unable to create the workspace." } });
    return;
  }
  res.status(201).json({ data });
});

foundationRouter.get("/workspaces/:workspaceId", requireAuth, async (req: AuthenticatedRequest, res) => {
  const params = workspaceIdParamSchema.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: { code: "INVALID_WORKSPACE_ID", message: "Workspace ID is invalid." } }); return; }
  const client = userClient(req);
  const { data, error } = client ? await client.from("workspaces").select("id, name, slug, owner_id, created_at, updated_at").eq("id", params.data.workspaceId).maybeSingle() : { data: null, error: new Error("unavailable") };
  if (error) { res.status(error.message === "unavailable" ? 503 : 404).json({ error: { code: "WORKSPACE_NOT_FOUND", message: "Workspace not found or access is not authorized." } }); return; }
  res.json({ data });
});

foundationRouter.patch("/workspaces/:workspaceId", requireAuth, async (req: AuthenticatedRequest, res) => {
  const params = workspaceIdParamSchema.safeParse(req.params); const parsed = updateWorkspaceSchema.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: { code: "INVALID_WORKSPACE_UPDATE", message: "Workspace update is invalid." } }); return; }
  const client = userClient(req);
  const { data, error } = client ? await client.from("workspaces").update({ name: parsed.data.name }).eq("id", params.data.workspaceId).select("id, name, slug, owner_id, created_at, updated_at").maybeSingle() : { data: null, error: new Error("unavailable") };
  if (error || !data) { res.status(error?.message === "unavailable" ? 503 : 404).json({ error: { code: "WORKSPACE_UPDATE_FAILED", message: "Workspace could not be updated or access is not authorized." } }); return; }
  res.json({ data });
});

foundationRouter.get("/workspaces/:workspaceId/members", requireAuth, async (req: AuthenticatedRequest, res) => {
  const params = workspaceIdParamSchema.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: { code: "INVALID_WORKSPACE_ID", message: "Workspace ID is invalid." } }); return; }
  const client = userClient(req);
  const { data, error } = client ? await client.from("workspace_members").select("user_id, role, created_at").eq("workspace_id", params.data.workspaceId) : { data: null, error: new Error("unavailable") };
  if (error) { res.status(error.message === "unavailable" ? 503 : 404).json({ error: { code: "MEMBERS_LOOKUP_FAILED", message: "Members could not be loaded or access is not authorized." } }); return; }
  res.json({ data: data ?? [] });
});
