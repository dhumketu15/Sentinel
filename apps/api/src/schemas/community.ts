import { z } from "zod";

const uuid = z.string().uuid();
export const postSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(10000),
  topic: z.string().trim().min(2).max(60).default("general"),
  visibility: z.enum(["public", "workspace"]).default("public"),
  workspaceId: uuid.nullable().optional(),
});
export const updatePostSchema = postSchema.partial();
export const commentSchema = z.object({ body: z.string().trim().min(1).max(5000), parentCommentId: uuid.nullable().optional() });
export const reactionSchema = z.object({ reactionType: z.enum(["support", "insightful", "helpful"]) });
export const reportSchema = z.object({ reason: z.string().trim().min(3).max(500).default("Needs moderator review.") });
