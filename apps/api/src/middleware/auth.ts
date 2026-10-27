import type { NextFunction, Request, Response } from "express";
import { getUserFromAccessToken } from "../lib/supabase.js";

export type AuthenticatedRequest = Request & {
  user?: { id: string; email?: string; userMetadata: Record<string, unknown> };
  accessToken?: string;
};

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "A valid Supabase access token is required." } });
    return;
  }

  const user = await getUserFromAccessToken(token);
  if (!user) {
    res.status(401).json({ error: { code: "AUTH_INVALID", message: "The Supabase session is invalid or expired." } });
    return;
  }

  req.user = { id: user.id, email: user.email, userMetadata: user.user_metadata ?? {} };
  req.accessToken = token;
  next();
}
