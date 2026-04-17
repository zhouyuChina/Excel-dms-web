import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../lib/auditLog.js";

function normalizeGroupColor(input: string): string {
  const s = String(input || "").trim();
  if (!s) return "bg-blue-500";
  if (s.startsWith("bg-")) return s;
  return `bg-${s}-500`;
}

export function registerFieldGroups(app: Express, prisma: PrismaClient) {
  app.get("/api/field-groups", async (_req, res) => {
    const groups = await prisma.fieldGroup.findMany({
      orderBy: { sortOrder: "asc" },
    });
    res.json({
      items: groups.map((g) => ({
        id: g.id,
        name: g.name,
        color: normalizeGroupColor(g.color),
        isSystem: g.isSystem,
        sortOrder: g.sortOrder,
      })),
    });
  });

  app.post("/api/field-groups", async (req, res) => {
    const body = req.body as { name?: string; color?: string; sortOrder?: number; isSystem?: boolean };
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ error: "name_required" });
    if (body.isSystem) return res.status(400).json({ error: "cannot_create_system_group" });
    const maxSort = await prisma.fieldGroup.aggregate({ _max: { sortOrder: true } });
    const created = await prisma.fieldGroup.create({
      data: {
        name,
        color: normalizeGroupColor(String(body.color || "bg-blue-500")),
        sortOrder:
          body.sortOrder === undefined || !Number.isFinite(Number(body.sortOrder))
            ? (maxSort._max.sortOrder ?? 0) + 1
            : Number(body.sortOrder),
        isSystem: false,
      },
    });
    await writeAuditLog({
      action: "field-group.create",
      targetType: "field-group",
      targetId: created.id,
      detail: { name: created.name },
    });
    res.status(201).json({ item: created });
  });

  app.patch("/api/field-groups/:id", async (req, res) => {
    const id = req.params.id;
    const existing = await prisma.fieldGroup.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "not_found" });
    const body = req.body as { name?: string; color?: string; sortOrder?: number };
    const updated = await prisma.fieldGroup.update({
      where: { id },
      data: {
        name: body.name === undefined ? undefined : String(body.name).trim(),
        color: body.color === undefined ? undefined : normalizeGroupColor(String(body.color)),
        sortOrder:
          body.sortOrder === undefined || !Number.isFinite(Number(body.sortOrder))
            ? undefined
            : Number(body.sortOrder),
      },
    });
    await writeAuditLog({
      action: "field-group.patch",
      targetType: "field-group",
      targetId: updated.id,
      detail: { name: updated.name },
    });
    res.json({ item: updated });
  });

  app.delete("/api/field-groups/:id", async (req, res) => {
    const id = req.params.id;
    const existing = await prisma.fieldGroup.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "not_found" });
    if (existing.isSystem) return res.status(400).json({ error: "cannot_delete_system_group" });
    await prisma.fieldGroup.delete({ where: { id } });
    await writeAuditLog({
      action: "field-group.delete",
      targetType: "field-group",
      targetId: id,
      detail: { name: existing.name },
    });
    res.status(204).send();
  });
}

