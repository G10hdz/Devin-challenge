import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getActor, listUsers } from "@/kernel/session";
import { switchActor } from "./actions";

export const metadata: Metadata = {
  title: "Internal Tools Kernel PoC",
  description: "KYC review queue built on a code-first internal tools kernel",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [actor, users] = await Promise.all([getActor(), listUsers()]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
            <Link href="/cases" className="font-semibold">
              KYC Review Queue
            </Link>
            <nav className="flex gap-3 text-sm text-slate-600">
              <Link href="/cases" className="hover:underline">
                Cases
              </Link>
              {actor.role === "admin" && (
                <Link href="/audit" className="hover:underline">
                  Audit log
                </Link>
              )}
            </nav>
            <form action={switchActor} className="ml-auto flex items-center gap-2 text-sm">
              <label htmlFor="actorId" className="text-slate-500">
                Acting as (demo stub)
              </label>
              <select
                id="actorId"
                name="actorId"
                key={actor.id}
                defaultValue={actor.id}
                className="rounded border px-2 py-1"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.role}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-white">
                Switch
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
