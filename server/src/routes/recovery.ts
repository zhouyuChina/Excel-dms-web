import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import multer from "multer";
import { requireAuth, requireRole } from "./auth.js";
import { writeAuditLog } from "../lib/auditLog.js";

const SNAP_DIR = path.resolve(process.cwd(), ".data", "recovery");
const META_FILE = path.resolve(SNAP_DIR, "index.json");
const upload = multer({ dest: path.resolve(SNAP_DIR, "uploads") });

type RecoveryMeta = {
  id: string;
  label: string;
  createdAt: string;
  createdBy: string;
  rowCount: number;
  restoredAt?: string;
};

async function readMeta(): Promise<RecoveryMeta[]> {
  try {
    const raw = await fs.readFile(META_FILE, "utf8");
    const parsed = JSON.parse(raw) as RecoveryMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeMeta(items: RecoveryMeta[]) {
  await fs.mkdir(SNAP_DIR, { recursive: true });
  await fs.writeFile(META_FILE, JSON.stringify(items, null, 2), "utf8");
}

export function registerRecovery(app: Express, prisma: PrismaClient) {
  app.get("/api/recovery/snapshots", requireAuth, requireRole(["admin"]), async (_req, res) => {
    const items = await readMeta();
    items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    res.json({ items });
  });

  app.post("/api/recovery/snapshots", requireAuth, requireRole(["admin"]), async (req, res) => {
    const label = String((req.body as { label?: string })?.label || "").trim() || "手動快照";
    const rows = await prisma.customer.findMany();
    const id = randomUUID();
    const file = path.resolve(SNAP_DIR, `${id}.json`);
    await fs.mkdir(SNAP_DIR, { recursive: true });
    await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf8");
    const user = (req as any).user as { username: string };
    const items = await readMeta();
    items.push({
      id,
      label,
      createdAt: new Date().toISOString(),
      createdBy: user?.username || "unknown",
      rowCount: rows.length,
    });
    await writeMeta(items);
    await writeAuditLog({
      action: "recovery.snapshot.create",
      targetType: "recovery",
      targetId: id,
      detail: { label, rowCount: rows.length },
    });
    res.status(201).json({ id, rowCount: rows.length });
  });

  app.post("/api/recovery/snapshots/:id/restore", requireAuth, requireRole(["admin"]), async (req, res) => {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "snapshot_id_required" });
    const file = path.resolve(SNAP_DIR, `${id}.json`);
    let rows: any[] = [];
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw) as any[];
      rows = Array.isArray(parsed) ? parsed : [];
    } catch {
      return res.status(404).json({ error: "snapshot_not_found" });
    }
    const body = req.body as { mode?: "full" | "selected"; cuids?: string[] };
    const mode = body.mode === "selected" ? "selected" : "full";
    const selectedCuids = Array.isArray(body.cuids)
      ? [...new Set(body.cuids.map((x) => String(x).trim()).filter(Boolean))]
      : [];

    if (mode === "selected" && selectedCuids.length === 0) {
      return res.status(400).json({ error: "selected_cuids_required" });
    }

    const snapshotRowsByCuid = new Map<string, any>();
    for (const r of rows) snapshotRowsByCuid.set(String(r.cuid || ""), r);

    await prisma.$transaction(async (tx) => {
      if (mode === "full") {
        await tx.customerExportMark.deleteMany({});
        await tx.customer.deleteMany({});
        if (rows.length > 0) await tx.customer.createMany({ data: rows as any });
      } else {
        await tx.customerExportMark.deleteMany({ where: { cuid: { in: selectedCuids } } });
        await tx.customer.deleteMany({ where: { cuid: { in: selectedCuids } } });
        const restoreRows = selectedCuids
          .map((cuid) => snapshotRowsByCuid.get(cuid))
          .filter(Boolean);
        if (restoreRows.length > 0) await tx.customer.createMany({ data: restoreRows as any });
      }
    });
    const items = await readMeta();
    const idx = items.findIndex((x) => x.id === id);
    if (idx >= 0) {
      items[idx] = { ...items[idx]!, restoredAt: new Date().toISOString() };
      await writeMeta(items);
    }
    await writeAuditLog({
      action: "recovery.snapshot.restore",
      targetType: "recovery",
      targetId: id,
      detail: {
        mode,
        rowCount: rows.length,
        selectedCount: selectedCuids.length,
      },
    });
    res.json({ restored: true, rowCount: rows.length, mode, selectedCount: selectedCuids.length });
  });

  app.post("/api/recovery/snapshots/:id/preview", requireAuth, requireRole(["admin"]), async (req, res) => {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "snapshot_id_required" });
    const file = path.resolve(SNAP_DIR, `${id}.json`);
    let rows: any[] = [];
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw) as any[];
      rows = Array.isArray(parsed) ? parsed : [];
    } catch {
      return res.status(404).json({ error: "snapshot_not_found" });
    }
    const body = req.body as { mode?: "full" | "selected"; cuids?: string[] };
    const mode = body.mode === "selected" ? "selected" : "full";
    const selectedCuids = Array.isArray(body.cuids)
      ? [...new Set(body.cuids.map((x) => String(x).trim()).filter(Boolean))]
      : [];
    if (mode === "selected" && selectedCuids.length === 0) {
      return res.status(400).json({ error: "selected_cuids_required" });
    }
    const affectedRows = mode === "full" ? rows.length : selectedCuids.length;
    res.json({
      mode,
      affectedRows,
      snapshotRows: rows.length,
      selectedCount: selectedCuids.length,
    });
  });

  app.get(
    "/api/recovery/snapshots/:id/download",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      const id = String(req.params.id || "").trim();
      const file = path.resolve(SNAP_DIR, `${id}.json`);
      try {
        await fs.access(file);
      } catch {
        return res.status(404).json({ error: "snapshot_not_found" });
      }
      res.download(file, `snapshot-${id}.json`);
    }
  );

  app.delete(
    "/api/recovery/snapshots/:id",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      const id = String(req.params.id || "").trim();
      const file = path.resolve(SNAP_DIR, `${id}.json`);
      try {
        await fs.unlink(file);
      } catch {
        return res.status(404).json({ error: "snapshot_not_found" });
      }
      const items = await readMeta();
      await writeMeta(items.filter((x) => x.id !== id));
      await writeAuditLog({
        action: "recovery.snapshot.delete",
        targetType: "recovery",
        targetId: id,
      });
      res.status(204).send();
    }
  );

  app.post(
    "/api/recovery/snapshots/upload",
    requireAuth,
    requireRole(["admin"]),
    upload.single("file"),
    async (req, res) => {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "file_required" });
      const label = String((req.body as { label?: string })?.label || "").trim() || file.originalname;
      const raw = await fs.readFile(file.path, "utf8");
      await fs.unlink(file.path);
      let rows: any[] = [];
      try {
        const parsed = JSON.parse(raw) as any[];
        rows = Array.isArray(parsed) ? parsed : [];
      } catch {
        return res.status(400).json({ error: "invalid_snapshot_file" });
      }
      const id = randomUUID();
      await fs.mkdir(SNAP_DIR, { recursive: true });
      await fs.writeFile(path.resolve(SNAP_DIR, `${id}.json`), JSON.stringify(rows, null, 2), "utf8");
      const user = (req as any).user as { username: string };
      const items = await readMeta();
      items.push({
        id,
        label,
        createdAt: new Date().toISOString(),
        createdBy: user?.username || "unknown",
        rowCount: rows.length,
      });
      await writeMeta(items);
      await writeAuditLog({
        action: "recovery.snapshot.upload",
        targetType: "recovery",
        targetId: id,
        detail: { label, rowCount: rows.length },
      });
      res.status(201).json({ id, rowCount: rows.length, label });
    }
  );
}
