import { z } from "zod";

export const workspaceIdParamSchema = z.object({ workspaceId: z.string().uuid() });
export const createWorkspaceSchema = z.object({ name: z.string().trim().min(2).max(120), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80) });
export const updateProfileSchema = z.object({ fullName: z.string().trim().min(1).max(120).optional(), preferredLanguage: z.enum(["en", "hi"]).optional() }).refine((value) => value.fullName !== undefined || value.preferredLanguage !== undefined, { message: "At least one profile field is required." });
export const updateWorkspaceSchema = z.object({ name: z.string().trim().min(2).max(120).optional() }).refine((value) => value.name !== undefined, { message: "A workspace name is required." });
