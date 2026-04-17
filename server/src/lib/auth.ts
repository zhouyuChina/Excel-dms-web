import { createHmac, randomBytes, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";

type UserRecord = {
  id: string;
  username: string;
  password: string;
  role: "admin" | "editor" | "viewer";
  isActive: boolean;
};

const USERS_FILE = path.resolve(process.cwd(), ".data", "users.json");
const REFRESH_FILE = path.resolve(process.cwd(), ".data", "refresh-tokens.json");
const SECRET = process.env.AUTH_SECRET || "dev-auth-secret";
const ACCESS_TTL_SEC = 60 * 15;
const REFRESH_TTL_SEC = 60 * 60 * 24 * 7;

function b64(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function ub64(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

async function ensureUsers(): Promise<UserRecord[]> {
  try {
    const raw = await fs.readFile(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw) as UserRecord[];
    if (Array.isArray(parsed) && parsed.length) {
      let changed = false;
      for (const u of parsed) {
        if (!String(u.password).startsWith("$2")) {
          u.password = await bcrypt.hash(String(u.password), 10);
          changed = true;
        }
      }
      if (changed) {
        await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
        await fs.writeFile(USERS_FILE, JSON.stringify(parsed, null, 2), "utf8");
      }
      return parsed;
    }
  } catch {
    // ignore
  }
  const defaults: UserRecord[] = [
    {
      id: randomUUID(),
      username: "admin",
      password: await bcrypt.hash("admin123", 10),
      role: "admin",
      isActive: true,
    },
    {
      id: randomUUID(),
      username: "editor",
      password: await bcrypt.hash("editor123", 10),
      role: "editor",
      isActive: true,
    },
    {
      id: randomUUID(),
      username: "viewer",
      password: await bcrypt.hash("viewer123", 10),
      role: "viewer",
      isActive: true,
    },
  ];
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(defaults, null, 2), "utf8");
  return defaults;
}

export async function verifyUser(username: string, password: string) {
  const users = await ensureUsers();
  for (const u of users) {
    if (!u.isActive || u.username.toLowerCase() !== username.toLowerCase()) continue;
    const ok = await bcrypt.compare(password, u.password);
    if (ok) return u;
  }
  return null;
}

export function signToken(payload: {
  sub: string;
  username: string;
  role: "admin" | "editor" | "viewer";
  exp: number;
}): string {
  const p = b64(JSON.stringify(payload));
  const s = createHmac("sha256", SECRET).update(p).digest("base64url");
  return `${p}.${s}`;
}

export function verifyToken(token: string): null | {
  sub: string;
  username: string;
  role: "admin" | "editor" | "viewer";
  exp: number;
} {
  const [p, s] = String(token || "").split(".");
  if (!p || !s) return null;
  const expected = createHmac("sha256", SECRET).update(p).digest("base64url");
  if (expected !== s) return null;
  try {
    const payload = JSON.parse(ub64(p)) as {
      sub: string;
      username: string;
      role: "admin" | "editor" | "viewer";
      exp: number;
    };
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

type RefreshRecord = {
  tokenHash: string;
  userId: string;
  username: string;
  role: "admin" | "editor" | "viewer";
  exp: number;
  revokedAt?: string;
  createdAt: string;
};

function hashRefresh(token: string): string {
  return createHmac("sha256", SECRET).update(token).digest("base64url");
}

async function readRefreshRows(): Promise<RefreshRecord[]> {
  try {
    const raw = await fs.readFile(REFRESH_FILE, "utf8");
    const parsed = JSON.parse(raw) as RefreshRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRefreshRows(rows: RefreshRecord[]) {
  await fs.mkdir(path.dirname(REFRESH_FILE), { recursive: true });
  await fs.writeFile(REFRESH_FILE, JSON.stringify(rows, null, 2), "utf8");
}

export function getAccessTtlSec() {
  return ACCESS_TTL_SEC;
}

export function getRefreshTtlSec() {
  return REFRESH_TTL_SEC;
}

export async function issueRefreshToken(input: {
  userId: string;
  username: string;
  role: "admin" | "editor" | "viewer";
}) {
  const token = randomBytes(48).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + REFRESH_TTL_SEC;
  const rows = await readRefreshRows();
  rows.push({
    tokenHash: hashRefresh(token),
    userId: input.userId,
    username: input.username,
    role: input.role,
    exp,
    createdAt: new Date().toISOString(),
  });
  await writeRefreshRows(rows);
  return { token, exp };
}

export async function rotateRefreshToken(token: string): Promise<null | {
  userId: string;
  username: string;
  role: "admin" | "editor" | "viewer";
}> {
  const rows = await readRefreshRows();
  const now = Math.floor(Date.now() / 1000);
  const hash = hashRefresh(token);
  const row = rows.find((x) => x.tokenHash === hash && !x.revokedAt && x.exp > now);
  if (!row) return null;
  row.revokedAt = new Date().toISOString();
  await writeRefreshRows(rows);
  return { userId: row.userId, username: row.username, role: row.role };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const rows = await readRefreshRows();
  const hash = hashRefresh(token);
  const row = rows.find((x) => x.tokenHash === hash && !x.revokedAt);
  if (!row) return;
  row.revokedAt = new Date().toISOString();
  await writeRefreshRows(rows);
}
