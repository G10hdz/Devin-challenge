/**
 * Declarative RBAC.
 *
 * Every permission in the system lives in PERMISSIONS below. Nothing else in the
 * codebase decides who may do what: call `can()` or `requirePermission()`.
 */

export const ROLES = ["analyst", "approver", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  "case:list": ["analyst", "approver", "admin"],
  "case:read": ["analyst", "approver", "admin"],
  "case:reveal_pii": ["analyst", "approver", "admin"],
  "case:start_review": ["analyst", "admin"],
  "case:approve": ["approver", "admin"],
  "case:reject": ["approver", "admin"],
  "case:reassign": ["admin"],
  "audit:read": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export class ForbiddenError extends Error {
  constructor(public permission: Permission, public role: Role) {
    super(`Role "${role}" is not permitted to perform "${permission}"`);
    this.name = "ForbiddenError";
  }
}

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Single enforcement point. Throws ForbiddenError when the role lacks the permission. */
export function requirePermission(
  actor: { role: Role },
  permission: Permission,
): void {
  if (!can(actor.role, permission)) {
    throw new ForbiddenError(permission, actor.role);
  }
}

export function permissionsFor(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p));
}
