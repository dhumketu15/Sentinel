import { z } from "zod";

export const userRoleSchema = z.enum(["consumer", "business_owner", "business_member", "platform_admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const workspaceMemberRoleSchema = z.enum(["administrator", "editor", "viewer"]);
export type WorkspaceMemberRole = z.infer<typeof workspaceMemberRoleSchema>;

export const profileSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().nullable(),
  email: z.string().email().nullable(),
  role: userRoleSchema,
  preferredLanguage: z.enum(["en", "hi"]),
});
export type Profile = z.infer<typeof profileSchema>;

export const workspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  ownerId: z.string().uuid(),
  createdAt: z.string(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});

export const apiSuccess = <T extends z.ZodTypeAny>(data: T) => z.object({ data });

export const supportedLanguages = ["en", "hi"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const navSections = [
  "overview",
  "brands",
  "audits",
  "reports",
  "analytics",
  "assistant",
  "surveys",
  "community",
  "rewards",
  "settings",
] as const;
export type NavSection = (typeof navSections)[number];
