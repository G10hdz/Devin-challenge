import Link from "next/link";
import { prisma } from "@/kernel/db";
import { guard } from "@/kernel/guard";
import { logAudit } from "@/kernel/audit";
import { listUsers } from "@/kernel/session";

export const dynamic = "force-dynamic";

const STATUSES = ["pending", "in_review", "approved", "rejected"];

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assignee?: string; error?: string }>;
}) {
  const params = await searchParams;
  const users = await listUsers();

  const cases = await guard("case:list", async (actor) => {
    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.assignee
        ? { assigneeId: params.assignee === "unassigned" ? null : params.assignee }
        : {}),
    };
    const rows = await prisma.case.findMany({
      where,
      orderBy: { reference: "asc" },
      include: { assignee: true },
    });
    // Reads are audited, including list reads.
    await logAudit({
      actor,
      action: "case.list",
      targetType: "CaseList",
      targetId: "queue",
      metadata: { filters: params, resultCount: rows.length },
    });
    return rows;
  });

  return (
    <div className="space-y-4">
      {params.error && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {params.error}
        </p>
      )}
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Cases</h1>
        <p className="text-sm text-slate-500">{cases.length} shown</p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded border bg-white p-4 text-sm">
        <div className="flex flex-col">
          <label htmlFor="status" className="text-slate-500">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={params.status ?? ""}
            className="rounded border px-2 py-1"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label htmlFor="assignee" className="text-slate-500">
            Assignee
          </label>
          <select
            id="assignee"
            name="assignee"
            defaultValue={params.assignee ?? ""}
            className="rounded border px-2 py-1"
          >
            <option value="">All</option>
            <option value="unassigned">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-white">
          Filter
        </button>
        <Link href="/cases" className="text-slate-500 underline">
          Reset
        </Link>
      </form>

      <table className="w-full overflow-hidden rounded border bg-white text-sm">
        <thead className="bg-slate-100 text-left text-slate-600">
          <tr>
            <th className="px-3 py-2">Reference</th>
            <th className="px-3 py-2">Applicant</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Assignee</th>
            <th className="px-3 py-2">Risk</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="px-3 py-2 font-mono text-xs">{c.reference}</td>
              <td className="px-3 py-2">{c.applicantName}</td>
              <td className="px-3 py-2">{c.status}</td>
              <td className="px-3 py-2">{c.assignee?.name ?? "—"}</td>
              <td className="px-3 py-2">{c.riskScore}</td>
              <td className="px-3 py-2 text-right">
                <Link href={`/cases/${c.id}`} className="text-blue-700 underline">
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
