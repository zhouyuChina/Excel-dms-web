import type { Express, Request, Response, NextFunction } from "express";
import {
  getAccessTtlSec,
  getRefreshTtlSec,
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signToken,
  verifyToken,
  verifyUser,
} from "../lib/auth.js";

export type AuthUser = {
  sub: string;
  username: string;
  role: "admin" | "editor" | "viewer";
};

function getBearer(req: Request): string {
  const h = String(req.headers.authorization || "");
  if (!h.startsWith("Bearer ")) return "";
  return h.slice("Bearer ".length).trim();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getBearer(req);
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "unauthorized" });
  (req as Request & { user?: AuthUser }).user = {
    sub: payload.sub,
    username: payload.username,
    role: payload.role,
  };
  next();
}

export function requireRole(roles: Array<AuthUser["role"]>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: AuthUser }).user;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    if (!roles.includes(user.role)) return res.status(403).json({ error: "forbidden" });
    next();
  };
}

export function registerAuth(app: Express) {
  app.post("/api/auth/login", async (req, res) => {
    const body = req.body as { username?: string; password?: string };
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!username || !password) return res.status(400).json({ error: "username_password_required" });
    const user = await verifyUser(username, password);
    if (!user) return res.status(401).json({ error: "invalid_credentials" });
    const exp = Math.floor(Date.now() / 1000) + getAccessTtlSec();
    const token = signToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      exp,
    });
    const refresh = await issueRefreshToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });
    res.json({
      access_token: token,
      refresh_token: refresh.token,
      token_type: "Bearer",
      expires_in: getAccessTtlSec(),
      refresh_expires_in: getRefreshTtlSec(),
      user: { id: user.id, username: user.username, role: user.role },
    });
  });

  app.post("/api/auth/refresh", async (req, res) => {
    const refreshToken = String((req.body as { refresh_token?: string })?.refresh_token || "");
    if (!refreshToken) return res.status(400).json({ error: "refresh_token_required" });
    const payload = await rotateRefreshToken(refreshToken);
    if (!payload) return res.status(401).json({ error: "invalid_refresh_token" });
    const exp = Math.floor(Date.now() / 1000) + getAccessTtlSec();
    const accessToken = signToken({
      sub: payload.userId,
      username: payload.username,
      role: payload.role,
      exp,
    });
    const nextRefresh = await issueRefreshToken({
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    });
    res.json({
      access_token: accessToken,
      refresh_token: nextRefresh.token,
      token_type: "Bearer",
      expires_in: getAccessTtlSec(),
      refresh_expires_in: getRefreshTtlSec(),
    });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const refreshToken = String((req.body as { refresh_token?: string })?.refresh_token || "");
    if (refreshToken) await revokeRefreshToken(refreshToken);
    res.status(204).send();
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    const user = (req as Request & { user?: AuthUser }).user!;
    res.json({ user });
  });
}
