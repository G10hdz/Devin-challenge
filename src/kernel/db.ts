import { PrismaClient } from "@prisma/client";

/**
 * Data layer. The client is extended so that AuditLog has no update or delete
 * path at all: any attempt throws before reaching SQLite. SQLite triggers
 * (prisma/migrations/*_audit_append_only) are the second line of defence, so
 * raw SQL cannot mutate audit rows either.
 */

const BLOCKED_AUDIT_OPS = [
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
] as const;

export class AuditImmutableError extends Error {
  constructor(operation: string) {
    super(`AuditLog is append-only: "${operation}" is not allowed`);
    this.name = "AuditImmutableError";
  }
}

function createClient() {
  return new PrismaClient().$extends({
    query: {
      auditLog: Object.fromEntries(
        BLOCKED_AUDIT_OPS.map((op) => [
          op,
          () => {
            throw new AuditImmutableError(op);
          },
        ]),
      ),
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
