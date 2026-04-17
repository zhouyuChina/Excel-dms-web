import { promises as fs } from "fs";
import path from "path";
import type { Express } from "express";

const AUDIT_FILE = path.resolve(process.cwd(), ".data", "audit-log.jsonl");

type AuditRow = {
  at: string;
  action: string;
  actor: string;
  targetType: string;
  targetId: string;
  detail: Record<string, unknown>;
};

export function registerAuditLogs(app: Express) {
  app.get("/api/audit-logs", async (req, res) => {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, Math.floor(limitRaw)) : 100;
    const action = String(req.query.action || "").trim();

    let rows: AuditRow[] = [];
    try {
      const raw = await fs.readFile(AUDIT_FILE, "utf8");
      rows = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as AuditRow;
          } catch {
            return null;
          }
        })
        .filter((x): x is AuditRow => Boolean(x));
    } catch {
      rows = [];
    }

    const filtered = action ? rows.filter((r) => r.action === action) : rows;
    filtered.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    res.json({ items: filtered.slice(0, limit), total: filtered.length });
  });
}
