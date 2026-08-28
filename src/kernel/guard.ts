import { logAudit } from "./audit";
import { ForbiddenError, requirePermission, type Permission } from "./rbac";
import { getActor, type Actor } from "./session";

/**
 * The single choke point every server action and page goes through.
 *
 * `guard` resolves the session actor, enforces the declarative permission and
 * writes an `access.denied` audit row when the check fails. Callers never
 * re-implement authorisation.
 */
export async function guard<T>(
  permission: Permission,
  handler: (actor: Actor) => Promise<T>,
  target?: { type: string; id: string },
): Promise<T> {
  const actor = await getActor();
  try {
    requirePermission(actor, permission);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      await logAudit({
        actor,
        action: "access.denied",
        targetType: target?.type ?? "permission",
        targetId: target?.id ?? permission,
        metadata: { permission },
      });
    }
    throw error;
  }
  return handler(actor);
}
