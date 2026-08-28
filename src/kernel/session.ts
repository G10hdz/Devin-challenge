import { cookies } from "next/headers";
import { prisma } from "./db";
import type { Role } from "./rbac";

/**
 * Session auth stub. There is NO identity provider here: the demo stores the
 * acting user id in a cookie and a header switcher changes it. Production would
 * replace exactly this file with a real IdP/SSO session.
 */

export const SESSION_COOKIE = "poc_actor_id";

export type Actor = {
  id: string;
  name: string;
  role: Role;
};

export async function listUsers(): Promise<Actor[]> {
  const users = await prisma.user.findMany({ orderBy: { role: "asc" } });
  return users.map((u) => ({ id: u.id, name: u.name, role: u.role as Role }));
}

export async function getActor(): Promise<Actor> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  const user = id
    ? await prisma.user.findUnique({ where: { id } })
    : await prisma.user.findFirst({ where: { role: "analyst" } });
  const fallback = user ?? (await prisma.user.findFirst());
  if (!fallback) {
    throw new Error("No users in the database. Run `npm run db:seed` first.");
  }
  return {
    id: fallback.id,
    name: fallback.name,
    role: fallback.role as Role,
  };
}
