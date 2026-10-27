import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { getPublicClient, getServiceClient, getUserScopedClient } from "../lib/supabase.js";
import { commentSchema, postSchema, reactionSchema, reportSchema, updatePostSchema } from "../schemas/community.js";

export const communityRouter = Router();
const actionWindows = new Map<string, { count: number; resetAt: number }>();
function readClient(req: AuthenticatedRequest) { return req.accessToken ? getUserScopedClient(req.accessToken) : getPublicClient(); }
function writeClient(req: AuthenticatedRequest) { return req.accessToken ? getUserScopedClient(req.accessToken) : null; }
function rateAllowed(userId: string, action: string, limit: number) { const key = `${userId}:${action}`; const now = Date.now(); const current = actionWindows.get(key); if (!current || current.resetAt <= now) { actionWindows.set(key, { count: 1, resetAt: now + 60_000 }); return true; } if (current.count >= limit) return false; current.count += 1; return true; }
async function award(userId: string, points: number, sourceType: string, sourceId: string, idempotencyKey: string, description: string) { const client = getServiceClient(); if (!client) return; await client.rpc("award_reward_points", { p_user_id: userId, p_points: points, p_source_type: sourceType, p_source_id: sourceId, p_idempotency_key: idempotencyKey, p_description: description }); }
function cleanSearch(value: string) { return value.replace(/[%,()]/g, " ").trim().slice(0, 80); }

communityRouter.get("/community/posts", async (req: AuthenticatedRequest, res) => {
  const client = readClient(req); if (!client) { res.status(503).json({ error: { code: "COMMUNITY_UNAVAILABLE", message: "Community service is not configured." } }); return; }
  const page = Math.max(0, Number(req.query.page ?? 0) || 0); const topic = typeof req.query.topic === "string" ? req.query.topic.trim() : ""; const search = typeof req.query.search === "string" ? cleanSearch(req.query.search) : ""; const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  let query: any = client.from("community_posts").select("id, author_id, workspace_id, title, body, topic, visibility, status, created_at, updated_at, community_comments(count), community_reactions(count)").eq("status", "published").order("created_at", { ascending: false });
  if (workspaceId && req.accessToken) query = query.eq("workspace_id", workspaceId); else query = query.eq("visibility", "public");
  if (topic) query = query.eq("topic", topic);
  if (search) query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`);
  const { data, error } = await query.range(page * 20, page * 20 + 19);
  if (error) { res.status(500).json({ error: { code: "COMMUNITY_FEED_FAILED", message: "Unable to load community posts." } }); return; }
  const posts = (data ?? []).map((post: any) => ({ ...post, commentCount: post.community_comments?.[0]?.count ?? 0, reactionCount: post.community_reactions?.[0]?.count ?? 0, community_comments: undefined, community_reactions: undefined }));
  res.json({ data: posts, page, hasMore: posts.length === 20 });
});

communityRouter.get("/community/posts/:postId/comments", async (req: AuthenticatedRequest, res) => {
  const client = readClient(req); if (!client) { res.status(503).json({ error: { code: "COMMUNITY_UNAVAILABLE", message: "Community service is not configured." } }); return; }
  const { data, error } = await client.from("community_comments").select("id, post_id, parent_comment_id, author_id, body, created_at, updated_at").eq("post_id", req.params.postId).eq("status", "published").order("created_at", { ascending: true }).limit(200);
  if (error) { res.status(500).json({ error: { code: "COMMUNITY_COMMENTS_FAILED", message: "Unable to load comments." } }); return; }
  res.json({ data: data ?? [] });
});

communityRouter.get("/community/posts/:postId", async (req: AuthenticatedRequest, res) => {
  const client = readClient(req); if (!client) { res.status(503).json({ error: { code: "COMMUNITY_UNAVAILABLE", message: "Community service is not configured." } }); return; }
  const { data, error } = await client.from("community_posts").select("id, author_id, workspace_id, title, body, topic, visibility, status, created_at, updated_at").eq("id", req.params.postId).eq("status", "published").maybeSingle();
  if (error || !data) { res.status(404).json({ error: { code: "COMMUNITY_POST_NOT_FOUND", message: "Post was not found or is not accessible." } }); return; }
  res.json({ data });
});

communityRouter.post("/community/posts", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = postSchema.safeParse(req.body); const client = writeClient(req);
  if (!parsed.success || !client || !req.user?.id) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "COMMUNITY_UNAVAILABLE" : "INVALID_POST", message: !client ? "Community service is not configured." : parsed.success ? "A valid session is required." : parsed.error.issues[0]?.message ?? "Post details are invalid." } }); return; }
  if (!rateAllowed(req.user.id, "post", 5)) { res.status(429).json({ error: { code: "POST_RATE_LIMIT", message: "Please wait before publishing another post." } }); return; }
  const workspaceId = parsed.data.visibility === "workspace" ? parsed.data.workspaceId ?? null : null;
  if (parsed.data.visibility === "workspace" && !workspaceId) { res.status(400).json({ error: { code: "WORKSPACE_REQUIRED", message: "Workspace posts need a workspace ID." } }); return; }
  const { data, error } = await client.from("community_posts").insert({ author_id: req.user.id, workspace_id: workspaceId, title: parsed.data.title, body: parsed.data.body, topic: parsed.data.topic, visibility: parsed.data.visibility, status: "published" }).select("id, author_id, workspace_id, title, body, topic, visibility, status, created_at, updated_at").single();
  if (error || !data) { res.status(500).json({ error: { code: "POST_CREATE_FAILED", message: "Unable to publish your post." } }); return; }
  await award(req.user.id, 15, "community_post", data.id, `community-post:${data.id}`, "Published a constructive community post.");
  res.status(201).json({ data });
});

communityRouter.patch("/community/posts/:postId", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = updatePostSchema.safeParse(req.body); const client = writeClient(req);
  if (!parsed.success || !client) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "COMMUNITY_UNAVAILABLE" : "INVALID_POST_UPDATE", message: !client ? "Community service is not configured." : "Post update is invalid." } }); return; }
  const update = Object.fromEntries(Object.entries(parsed.data).filter(([key]) => key !== "workspaceId").map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), key === "visibility" && value === "public" ? value : value]));
  if (parsed.data.visibility === "public") update.workspace_id = null;
  if (parsed.data.visibility === "workspace") { if (!parsed.data.workspaceId) { res.status(400).json({ error: { code: "WORKSPACE_REQUIRED", message: "Workspace posts need a workspace ID." } }); return; } update.workspace_id = parsed.data.workspaceId; }
  const { data, error } = await client.from("community_posts").update(update).eq("id", req.params.postId).select("id, author_id, workspace_id, title, body, topic, visibility, status, created_at, updated_at").maybeSingle();
  if (error || !data) { res.status(404).json({ error: { code: "POST_UPDATE_FAILED", message: "Post was not found or you do not own it." } }); return; }
  res.json({ data });
});

communityRouter.delete("/community/posts/:postId", requireAuth, async (req: AuthenticatedRequest, res) => {
  const client = writeClient(req); if (!client) { res.status(503).json({ error: { code: "COMMUNITY_UNAVAILABLE", message: "Community service is not configured." } }); return; }
  const { error } = await client.from("community_posts").delete().eq("id", req.params.postId); if (error) { res.status(404).json({ error: { code: "POST_DELETE_FAILED", message: "Post was not found or you do not own it." } }); return; } res.status(204).send();
});

communityRouter.post("/community/posts/:postId/comments", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = commentSchema.safeParse(req.body); const client = writeClient(req);
  if (!parsed.success || !client || !req.user?.id) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "COMMUNITY_UNAVAILABLE" : "INVALID_COMMENT", message: !client ? "Community service is not configured." : parsed.success ? "A valid session is required." : parsed.error.issues[0]?.message ?? "Comment is invalid." } }); return; }
  if (!rateAllowed(req.user.id, "comment", 20)) { res.status(429).json({ error: { code: "COMMENT_RATE_LIMIT", message: "Please slow down before adding another comment." } }); return; }
  if (parsed.data.parentCommentId) { const { data: parent } = await client.from("community_comments").select("id").eq("id", parsed.data.parentCommentId).eq("post_id", req.params.postId).maybeSingle(); if (!parent) { res.status(400).json({ error: { code: "INVALID_REPLY_PARENT", message: "Replies must stay on the same post thread." } }); return; } }
  const { data, error } = await client.from("community_comments").insert({ post_id: req.params.postId, parent_comment_id: parsed.data.parentCommentId ?? null, author_id: req.user.id, body: parsed.data.body, status: "published" }).select("id, post_id, parent_comment_id, author_id, body, created_at, updated_at").single();
  if (error || !data) { res.status(500).json({ error: { code: "COMMENT_CREATE_FAILED", message: "Unable to publish your comment." } }); return; }
  await award(req.user.id, 3, "community_comment", data.id, `community-comment:${data.id}`, "Added a constructive community comment.");
  res.status(201).json({ data });
});

communityRouter.patch("/community/comments/:commentId", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = commentSchema.partial().safeParse(req.body); const client = writeClient(req);
  if (!parsed.success || !client) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "COMMUNITY_UNAVAILABLE" : "INVALID_COMMENT_UPDATE", message: !client ? "Community service is not configured." : "Comment update is invalid." } }); return; }
  const update = Object.fromEntries(Object.entries(parsed.data).filter(([key]) => key === "body").map(([key, value]) => [key, value]));
  const { data, error } = await client.from("community_comments").update(update).eq("id", req.params.commentId).select("id, post_id, parent_comment_id, author_id, body, created_at, updated_at").maybeSingle();
  if (error || !data) { res.status(404).json({ error: { code: "COMMENT_UPDATE_FAILED", message: "Comment was not found or you do not own it." } }); return; }
  res.json({ data });
});

communityRouter.delete("/community/comments/:commentId", requireAuth, async (req: AuthenticatedRequest, res) => {
  const client = writeClient(req); if (!client) { res.status(503).json({ error: { code: "COMMUNITY_UNAVAILABLE", message: "Community service is not configured." } }); return; }
  const { error } = await client.from("community_comments").delete().eq("id", req.params.commentId); if (error) { res.status(404).json({ error: { code: "COMMENT_DELETE_FAILED", message: "Comment was not found or you do not own it." } }); return; } res.status(204).send();
});

communityRouter.post("/community/posts/:postId/reaction", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = reactionSchema.safeParse(req.body); const client = writeClient(req);
  if (!parsed.success || !client || !req.user?.id) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "COMMUNITY_UNAVAILABLE" : "INVALID_REACTION", message: !client ? "Community service is not configured." : "Reaction is invalid." } }); return; }
  const { data, error } = await client.from("community_reactions").upsert({ post_id: req.params.postId, user_id: req.user.id, reaction_type: parsed.data.reactionType }, { onConflict: "post_id,user_id" }).select("post_id, user_id, reaction_type").single();
  if (error || !data) { res.status(500).json({ error: { code: "REACTION_FAILED", message: "Unable to save your reaction." } }); return; }
  res.status(201).json({ data });
});

communityRouter.delete("/community/posts/:postId/reaction", requireAuth, async (req: AuthenticatedRequest, res) => {
  const client = writeClient(req); if (!client || !req.user?.id) { res.status(!client ? 503 : 401).json({ error: { code: !client ? "COMMUNITY_UNAVAILABLE" : "AUTH_REQUIRED", message: !client ? "Community service is not configured." : "A valid session is required." } }); return; }
  const { error } = await client.from("community_reactions").delete().eq("post_id", req.params.postId).eq("user_id", req.user.id); if (error) { res.status(500).json({ error: { code: "REACTION_REMOVE_FAILED", message: "Unable to remove your reaction." } }); return; } res.status(204).send();
});

communityRouter.post("/community/posts/:postId/report", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = reportSchema.safeParse(req.body); const client = writeClient(req);
  if (!parsed.success || !client || !req.user?.id) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "COMMUNITY_UNAVAILABLE" : "INVALID_REPORT", message: !client ? "Community service is not configured." : "Report is invalid." } }); return; }
  const { error } = await client.from("community_reports").insert({ post_id: req.params.postId, reporter_id: req.user.id, reason: parsed.data.reason });
  if (error) { res.status(error.code === "23505" ? 409 : 500).json({ error: { code: error.code === "23505" ? "ALREADY_REPORTED" : "REPORT_FAILED", message: error.code === "23505" ? "You have already reported this post." : "Unable to submit the report." } }); return; }
  res.status(201).json({ data: { reported: true } });
});

communityRouter.post("/community/comments/:commentId/report", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = reportSchema.safeParse(req.body); const client = writeClient(req);
  if (!parsed.success || !client || !req.user?.id) { res.status(!client ? 503 : 400).json({ error: { code: !client ? "COMMUNITY_UNAVAILABLE" : "INVALID_REPORT", message: !client ? "Community service is not configured." : "Report is invalid." } }); return; }
  const { error } = await client.from("community_reports").insert({ comment_id: req.params.commentId, reporter_id: req.user.id, reason: parsed.data.reason });
  if (error) { res.status(error.code === "23505" ? 409 : 500).json({ error: { code: error.code === "23505" ? "ALREADY_REPORTED" : "REPORT_FAILED", message: error.code === "23505" ? "You have already reported this comment." : "Unable to submit the report." } }); return; }
  res.status(201).json({ data: { reported: true } });
});
