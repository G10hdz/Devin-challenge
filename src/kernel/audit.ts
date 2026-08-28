import { prisma } from "./db";
import type { Actor } from "./session";

/**
 * Append-only audit log.
 *
 * READS are audited, not only writes: opening a case record or revealing a
 * masked field writes a row. There is no update/delete helper here on purpose,
 * and the data layer rejects those operations (src/kernel/db.ts + SQLite
 * triggers).
 */

export type AuditAction =
  | "case.list"
  | "case.read"
  | "case.pii_reveal"
  | "case.start_review"
  | "case.approve"
  | "case.reject"
  | "case.reassign"
  | "access.denied";

export async function logAudit(input: {
  actor: Actor;
  action: AuditAction;
  targetType: string;
  targetId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actor.id,
      actorName: input.actor.name,
      actorRole: input.actor.role,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function auditTrailFor(targetType: string, targetId: string) {
  return prisma.auditLog.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: "desc" },
  });
}

export async function recentAudit(limit = 100) {
  return prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}
