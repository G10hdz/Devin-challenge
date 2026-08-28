# Internal Tools Kernel PoC — KYC Review Queue

A 2-hour, build-vs-buy proof of concept: a small **code-first internal tools kernel**
plus **one app** built on it (a KYC review queue).

The thesis: Power Apps already gives this team RBAC and CRUD. What it does not give,
without significant custom work, is (1) an audit log that records **reads**,
(2) enforced **separation of duties** (approver ≠ requester), and (3) **PII masked by
default with reveal-on-reason**. Those three things are exactly what this kernel makes
the default for every app built on it.

This is a PoC. It is not production software — see "What this is NOT".

## Run it

```bash
npm install      # also runs `prisma generate`
npm run db:seed  # applies migrations and seeds 25 obviously fake cases
npm run dev      # http://localhost:3000
npm test         # the two evidence tests (requires db:seed first)
```

No Docker, no external services, no cloud dependencies, no IdP. SQLite file at
`prisma/dev.db`.

## Demo path (2 minutes)

1. Header role switcher (a stub, not real auth) — start as **Ana Analyst**.
2. `/cases` — filter by status and assignee. Opening the list is itself audited.
3. Open a case: PII fields are masked. Click **Reveal PII** — a reason is required, and
   the reveal is written to the audit log with that reason.
4. Move a pending case to `in_review` as Ana. Try to approve it as Ana — the action is
   not offered (analyst lacks `case:approve`) and is refused by the kernel if forced.
5. Switch to **Pat Approver** and approve with a required reason. Then switch to the
   analyst who moved the case into review and try again on another case: separation of
   duties blocks it.
6. Switch to **Sam Admin** → `/audit` shows the append-only trail, including every read.

## The kernel (`src/kernel/`)

| File | Responsibility |
| --- | --- |
| `rbac.ts` | One `PERMISSIONS` config object mapping permission → allowed roles, plus `can()` / `requirePermission()`. Authorisation lives nowhere else. |
| `guard.ts` | The single choke point: resolves the actor, enforces the permission, writes an `access.denied` audit row on refusal, then runs the handler. |
| `audit.ts` | Append-only audit writer. Records reads (`case.read`, `case.list`), reveals (`case.pii_reveal`) and writes. No update/delete helper exists. |
| `db.ts` | Prisma client extended so `update/updateMany/upsert/delete/deleteMany` on `AuditLog` throw `AuditImmutableError`. |
| `pii.ts` | `PII_FIELDS` + masking helpers; fields render masked unless explicitly revealed. |
| `session.ts` | Session **stub**: acting user id in a cookie. Replace this one file with a real IdP. |

Append-only is enforced twice: in the data layer above, and by SQLite triggers in
`prisma/migrations/20260828143000_audit_append_only/migration.sql`, so raw SQL cannot
tamper with audit rows either.

## How to add the next internal app on this kernel

Say the next app is a "vendor payment approvals" tool. Concretely:

1. **Model** — add to `prisma/schema.prisma` (copy the shape of `Case`; keep PII fields
   as plain string columns so `pii.ts` can mask them), then
   `npx prisma migrate dev --name vendor_payments`.
2. **Permissions** — add entries to the `PERMISSIONS` object in `src/kernel/rbac.ts`,
   e.g. `"payment:read": ["analyst","approver","admin"]`,
   `"payment:approve": ["approver","admin"]`. Nothing else needs to know about roles.
3. **Actions** — create `src/app/payments/actions.ts` modelled on
   `src/app/actions.ts`: every action body is `guard("<permission>", async (actor) => {
   ...mutate...; await logAudit({ actor, action, targetType, targetId, reason }) })`.
   Required-reason and approver ≠ requester are ~5 lines each (see `decideCase`).
4. **List view** — `src/app/payments/page.tsx`, copied from `src/app/cases/page.tsx`:
   wrap the query in `guard("payment:list", ...)` and log a `list` audit row.
5. **Detail view** — `src/app/payments/[id]/page.tsx`, copied from
   `src/app/cases/[id]/page.tsx`: `guard("payment:read", ...)` logs the read, masked
   fields come from `maskUnlessRevealed`, and the reveal form posts a reason.
6. **Audit trail** — nothing to build: `auditTrailFor("Payment", id)` renders it, and
   `/audit` picks the new actions up automatically.

The audit, masking, and permission plumbing is not rewritten per app — it is four
imports. That is the point of the kernel, and why the next app is hours, not weeks.

## Evidence (`tests/kernel.test.ts`)

Exactly two tests, deliberately:

- an analyst calling a `case:approve`-guarded action is denied (and the denial is
  audited);
- audit rows cannot be updated or deleted — through Prisma **or** raw SQL.

## What this is NOT

Skipped on purpose in a 2-hour PoC. Production for a regulated fintech would need:

- **Real IdP/SSO** with MFA and group-mapped roles. `session.ts` is a cookie stub with a
  visible role switcher — anyone can become an admin.
- **Postgres** (or equivalent), migrations reviewed and run in CI, backups, PITR.
  SQLite here is a single local file.
- **Tamper-evident / WORM audit storage** — hash chaining or append-only object storage
  with retention locks, shipped off the transactional database. Triggers and a client
  extension stop application bugs, not a DBA with write access.
- **Data retention & deletion policy** (including how "append-only audit" coexists with
  erasure requests), plus classification of which fields are PII.
- **Secrets management** — no `.env` in git; KMS/secret manager, rotated credentials.
  (This repo commits a `.env` containing only a local SQLite path, on purpose, so the
  PoC runs with one command.)
- **Monitoring, alerting, on-call**, structured logs, and audit-log anomaly detection.
- **Accessibility review** (WCAG), keyboard navigation, screen-reader labels — the UI is
  unstyled-ish Tailwind and was not reviewed.
- **Penetration testing / threat model**, CSRF and rate-limit review, input validation
  at the boundary (no Zod here), and authorisation tests far beyond the two included.
- Concurrency control (two approvers acting at once), pagination, search, bulk actions,
  case history/comments, notifications, exports.

## What was harder or more ambiguous than expected

- **"Log reads" is easy; deciding what counts as a read is not.** A list view exposes 25
  applicant names — is that 1 read or 25? I log one `case.list` row with the filter and
  result count, plus one `case.read` per detail open. A regulator might want row-level
  list logging; that is a volume/usefulness trade-off worth an explicit decision.
- **Reveal-with-reason needs a duration.** "Revealed" is not a moment, it is a window. I
  chose a 5-minute cookie-scoped grant per case, so re-revealing after expiry forces a
  new reason. Re-opening the case during the window logs `case.read` with
  `piiRevealed: true` rather than a second reveal row.
- **Approver ≠ requester needs a definition of "requester".** There is no explicit
  requester in a KYC queue, so I bound it to `movedToReviewById` — the analyst who moved
  the case into review — and store it on the case at that moment rather than deriving it
  from the audit log at decision time.
- **Append-only is only as strong as its weakest layer.** The Prisma extension alone is
  application-level etiquette; the SQLite triggers were the part that made the claim
  honest, and they need a hand-written migration because Prisma does not model triggers.
