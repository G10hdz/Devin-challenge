import { recentAudit } from "@/kernel/audit";
import { guard } from "@/kernel/guard";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const rows = await guard("audit:read", () => recentAudit(200));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit log (append-only)</h1>
      <table className="w-full overflow-hidden rounded border bg-white text-xs">
        <thead className="bg-slate-100 text-left text-slate-600">
          <tr>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Actor</th>
            <th className="px-3 py-2">Action</th>
            <th className="px-3 py-2">Target</th>
            <th className="px-3 py-2">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t font-mono">
              <td className="px-3 py-2">{r.createdAt.toISOString()}</td>
              <td className="px-3 py-2">
                {r.actorName} ({r.actorRole})
              </td>
              <td className="px-3 py-2">{r.action}</td>
              <td className="px-3 py-2">
                {r.targetType}:{r.targetId}
              </td>
              <td className="px-3 py-2">{r.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
