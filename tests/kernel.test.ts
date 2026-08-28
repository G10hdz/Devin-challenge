import { describe, expect, it, vi } from "vitest";

// Session stub: every test acts as the seeded analyst.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "user-analyst-1" }) }),
}));

import { prisma, AuditImmutableError } from "@/kernel/db";
import { guard } from "@/kernel/guard";
import { ForbiddenError } from "@/kernel/rbac";

describe("kernel guarantees", () => {
  it("denies a state-changing action to a role without the permission", async () => {
    const handler = vi.fn();
    await expect(
      guard("case:approve", handler, { type: "Case", id: "case-under-test" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(handler).not.toHaveBeenCalled();
    const denial = await prisma.auditLog.findFirst({
      where: { action: "access.denied", targetId: "case-under-test" },
      orderBy: { createdAt: "desc" },
    });
    expect(denial?.actorRole).toBe("analyst");
  });

  it("cannot update or delete audit rows", async () => {
    const row = await prisma.auditLog.create({
      data: {
        actorId: "user-analyst-1",
        actorName: "Ana Analyst",
        actorRole: "analyst",
        action: "case.read",
        targetType: "Case",
        targetId: "immutability-test",
      },
    });

    // Blocked in the data layer (Prisma client extension)...
    await expect(
      prisma.auditLog.update({ where: { id: row.id }, data: { action: "tampered" } }),
    ).rejects.toBeInstanceOf(AuditImmutableError);
    await expect(
      prisma.auditLog.delete({ where: { id: row.id } }),
    ).rejects.toBeInstanceOf(AuditImmutableError);

    // ...and again in SQLite, so raw SQL cannot tamper either.
    await expect(
      prisma.$executeRawUnsafe(`UPDATE "AuditLog" SET action='tampered' WHERE id=?`, row.id),
    ).rejects.toThrow(/append-only/);
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "AuditLog" WHERE id=?`, row.id),
    ).rejects.toThrow(/append-only/);

    const stillThere = await prisma.auditLog.findUnique({ where: { id: row.id } });
    expect(stillThere?.action).toBe("case.read");
  });
});
