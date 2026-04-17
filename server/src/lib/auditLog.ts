import { promises as fs } from "fs";
import path from "path";

const AUDIT_FILE = path.resolve(process.cwd(), ".data", "audit-log.jsonl");

export async function writeAuditLog(input: {
  action: string;
  actor?: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const row = {
    at: new Date().toISOString(),
    action: input.action,
    actor: input.actor || "local-user",
    targetType: input.targetType || "",
    targetId: input.targetId || "",
    detail: input.detail || {},
  };
  await fs.mkdir(path.dirname(AUDIT_FILE), { recursive: true });
  await fs.appendFile(AUDIT_FILE, `${JSON.stringify(row)}\n`, "utf8");
}
