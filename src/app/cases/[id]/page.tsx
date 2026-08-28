import { cookies } from "next/headers";
import Link from "next/link";
import { prisma } from "@/kernel/db";
import { auditTrailFor, logAudit } from "@/kernel/audit";
import { guard } from "@/kernel/guard";
import { can } from "@/kernel/rbac";
import { PII_FIELDS, maskUnlessRevealed } from "@/kernel/pii";
import { listUsers } from "@/kernel/session";
import { decideCase, reassignCase, revealPii, startReview } from "../../actions";
import { revealCookie } from "../../reveal";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const store = await cookies();
  const revealReason = store.get(revealCookie(id))?.value;
  const revealed = Boolean(revealReason);

  const { record, actor } = await guard(
    "case:read",
    async (actor) => {
      const record = await prisma.case.findUniqueOrThrow({
        where: { id },
        include: { assignee: true },
      });
      // Every open of a case record is audited — this is the behaviour the
      // low-code platform does not give us.
      await logAudit({
        actor,
        action: "case.read",
        targetType: "Case",
        targetId: id,
        metadata: { reference: record.reference, piiRevealed: revealed },
      });
      return { record, actor };
    },
    { type: "Case", id },
  );

  const [trail, users] = await Promise.all([auditTrailFor("Case", id), listUsers()]);
  const isMover = record.movedToReviewById === actor.id;

  return (
    <div className="space-y-6">
      <Link href="/cases" className="text-sm text-blue-700 underline">
        ← Back to queue
      </Link>

      {error && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="rounded border bg-white p-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold">{record.reference}</h1>
          <span className="rounded bg-slate-100 px-2 py-1 text-xs uppercase">
            {record.status}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Field label="Applicant" value={record.applicantName} />
          <Field label="Country" value={record.country} />
          <Field label="Risk score" value={String(record.riskScore)} />
          <Field label="Assignee" value={record.assignee?.name ?? "Unassigned"} />
          {PII_FIELDS.map((field) => (
            <Field
              key={field}
              label={`${field} (PII)`}
              value={maskUnlessRevealed(record[field], revealed)}
            />
          ))}
          {record.decisionReason && (
            <Field label="Decision reason" value={record.decisionReason} />
          )}
        </dl>

        {revealed ? (
          <p className="mt-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
            PII revealed for 5 minutes. Reason logged: “{revealReason}”
          </p>
        ) : (
          <form action={revealPii} className="mt-4 flex flex-wrap items-end gap-2 text-sm">
            <input type="hidden" name="caseId" value={record.id} />
            <div className="flex grow flex-col">
              <label htmlFor="reason" className="text-slate-500">
                Reason to reveal PII (required, audited)
              </label>
              <input
                id="reason"
                name="reason"
                required
                className="rounded border px-2 py-1"
                placeholder="e.g. verifying document against sanctions hit"
              />
            </div>
            <button type="submit" className="rounded bg-amber-600 px-3 py-1.5 text-white">
              Reveal PII
            </button>
          </form>
        )}
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Actions</h2>
        <div className="mt-3 space-y-4 text-sm">
          {record.status === "pending" && can(actor.role, "case:start_review") && (
            <form action={startReview}>
              <input type="hidden" name="caseId" value={record.id} />
              <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-white">
                Move to in_review
              </button>
            </form>
          )}

          {record.status === "in_review" && can(actor.role, "case:approve") && (
            <form action={decideCase} className="space-y-2">
              <input type="hidden" name="caseId" value={record.id} />
              <label htmlFor="decision-reason" className="block text-slate-500">
                Decision reason (required)
              </label>
              <textarea
                id="decision-reason"
                name="reason"
                required
                rows={2}
                className="w-full rounded border px-2 py-1"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  name="decision"
                  value="approved"
                  className="rounded bg-emerald-700 px-3 py-1.5 text-white"
                >
                  Approve
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="rejected"
                  className="rounded bg-red-700 px-3 py-1.5 text-white"
                >
                  Reject
                </button>
              </div>
              {isMover && (
                <p className="text-amber-700">
                  You moved this case into review — separation of duties will block your
                  decision.
                </p>
              )}
            </form>
          )}

          {can(actor.role, "case:reassign") && (
            <form action={reassignCase} className="flex items-end gap-2">
              <input type="hidden" name="caseId" value={record.id} />
              <div className="flex flex-col">
                <label htmlFor="assigneeId" className="text-slate-500">
                  Reassign to
                </label>
                <select
                  id="assigneeId"
                  name="assigneeId"
                  defaultValue={record.assigneeId ?? ""}
                  className="rounded border px-2 py-1"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.role}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-white">
                Reassign
              </button>
            </form>
          )}

          {!can(actor.role, "case:approve") && !can(actor.role, "case:reassign") && (
            <p className="text-slate-500">
              Your role ({actor.role}) cannot approve, reject or reassign cases.
            </p>
          )}
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Audit trail for this case</h2>
        <ul className="mt-3 space-y-1 text-xs text-slate-600">
          {trail.map((row) => (
            <li key={row.id} className="font-mono">
              {row.createdAt.toISOString()} · {row.actorName} ({row.actorRole}) ·{" "}
              {row.action}
              {row.reason ? ` · “${row.reason}”` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
