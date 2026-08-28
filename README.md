# Internal Tools Kernel — PoC for a build-vs-buy decision

**Audience: the VP of Engineering evaluating whether to keep renewing the internal-tool
platform (~$250K/year, 3 apps today, 10+ planned) or to build these tools in-house with
Devin.**

This repository is a working proof of concept, built in a 2-hour time box: a small
**internal tools kernel** plus **one real app on it** (a KYC review queue). Clone it, run
three commands, and click through it — that is the whole pitch.

```bash
npm install && npm run db:seed && npm run dev   # http://localhost:3000
```

## TL;DR

- **The kernel is the asset, not the app.** 260 lines in `src/kernel/` give every future
  internal app RBAC, read-level auditing, and PII masking *by default*. The KYC app —
  every page and action — is ~620 lines of mostly UI on top of it.
- **It does three things your current platform does not do out of the box**: log record
  **reads**, enforce **approver ≠ requester**, and mask **PII by default with
  reveal-on-reason**. Each of those is a compliance conversation you are having anyway.
- **The marginal cost of app #4 through #13 is the point.** Once the kernel exists, a new
  app is a Prisma model, one line in a permissions object, and two copied pages.
- **This is a PoC, not production.** The honest list of what a regulated fintech still
  has to build is in [What this is NOT](#what-this-is-not). The licence saving is real;
  it is not free.

## Why KYC review was chosen for the demo

Deliberately, for three reasons:

1. **It is the least interesting app you own.** A review queue is CRUD plus a state
   machine. Nobody joins a fintech to maintain one — which is exactly why it is the right
   test of whether an agent can own this class of work instead of your engineers.
2. **It is the most compliance-loaded.** A queue where analysts read applicant PII and
   approve or reject people is where "who looked at what, and why" actually matters. If a
   code-first kernel wins anywhere, it wins here.
3. **It generalises.** Refunds dashboard and feature-flag admin are the same shape: a list,
   a detail view, a privileged state change, and an audit requirement. The kernel does not
   know what a KYC case is.

## What this gives you that the low-code platform does not

Everything below is implemented and clickable, not aspirational.

| Capability | Where to see it | Why it matters to you |
| --- | --- | --- |
| **Reads are audited** | Open any case, then `/audit` as Sam Admin — a `case.read` row appears per open, `case.list` per filtered search | Low-code platforms log writes; "who viewed this applicant's tax ID last quarter" is the question an auditor actually asks |
| **Separation of duties** | Move a case to `in_review`, then try to approve it as the same user | Enforced in code (`decideCase`), not in a training document or a manual review step |
| **PII masked by default, reveal needs a reason** | Case detail — six masked fields, reveal form requires free text | The reason is stored with the reveal; masking is opt-out per field, not opt-in per screen |
| **Denials are evidence too** | Try `/audit` as an analyst | Refused access writes an `access.denied` row — you can prove the control fired |
| **Permissions are one object** | `src/kernel/rbac.ts` | Your auditors can read the entire authorisation model on one screen; it is diffable and code-reviewed |
| **Full customisation** | The whole repo | No connector limits, no premium-tier feature gates, no per-app licence maths |

## Try it yourself (5 minutes)

```bash
npm install      # also runs `prisma generate`
npm run db:seed  # migrations + 25 obviously fake cases (no real PII, ever)
npm run dev      # http://localhost:3000
npm test         # the two evidence tests (run db:seed first)
```

No Docker, no external services, no cloud dependencies, no identity provider. Data lives
in a local SQLite file at `prisma/dev.db`.

1. Use the header role switcher (a demo stub, not real auth) — start as **Ana Analyst**.
2. `/cases` — filter by status and assignee. Opening the list is itself audited.
3. Open a case: PII is masked. **Reveal PII** demands a reason, and logs it.
4. Move a pending case to `in_review` as Ana, then try to approve it — an analyst has no
   approve permission, and the kernel refuses even if the button is forced.
5. Switch to **Pat Approver** and approve with a required reason. Then have the same user
   who moved a case into review try to decide it: separation of duties blocks it.
6. Switch to **Sam Admin** → `/audit` for the append-only trail, including every read.

## The cost conversation

Honest framing, with the assumptions written down so you can substitute your own numbers.

**What you are paying for today:** ~$250K/year for 3 apps ≈ $83K per app per year, and
that price does not fall when the tenth app ships — it usually rises with seats and
premium connectors.

**What building costs instead** (estimates, not a quote; assume a fully-loaded engineer
at ~$250K/year ≈ ~$5K/week):

| Item | Estimate | Note |
| --- | --- | --- |
| This PoC (kernel + 1 app, demo grade) | 2 hours | What you are looking at |
| Hardening the kernel for production | ~3–6 engineer-weeks | SSO, Postgres, deploys, WORM audit storage, monitoring, pentest — the [What this is NOT](#what-this-is-not) list |
| First production app on it | ~1–2 engineer-weeks | KYC, including a real workflow rather than a demo one |
| Each additional app (#2–#13) | ~0.5–1.5 engineer-weeks | The marginal number that decides this |
| Ongoing ownership | ~0.25–0.5 FTE | Upgrades, on-call, access reviews — this never goes to zero |

The one-time kernel investment is the risk; the marginal per-app cost is the return. The
break-even is not "does app #1 cost less than $83K" — it is "does app #13 still cost you
almost nothing", and with a kernel it does.

**What you give up by leaving the platform:** somebody else's uptime, their compliance
attestations, their upgrade treadmill, and a citizen-developer story for non-engineers.
If business users — not engineers — are building and changing those apps today, that is a
genuine argument for keeping the licence, and this PoC does not refute it.

## How to add the next internal app on this kernel

This is the claim the whole evaluation rests on, so here it is concretely. Say the next
app is the refunds dashboard:

1. **Model** — add it to `prisma/schema.prisma` (copy the shape of `Case`; keep PII fields
   as plain string columns so `pii.ts` can mask them), then
   `npx prisma migrate dev --name refunds`.
2. **Permissions** — add entries to the `PERMISSIONS` object in `src/kernel/rbac.ts`, e.g.
   `"refund:read": ["analyst","approver","admin"]`,
   `"refund:approve": ["approver","admin"]`. Nothing else in the codebase learns about
   roles.
3. **Actions** — create `src/app/refunds/actions.ts` modelled on `src/app/actions.ts`.
   Every action body is
   `guard("<permission>", async (actor) => { ...mutate...; await logAudit({ actor, action, targetType, targetId, reason }) })`.
   Required-reason and approver ≠ requester are ~5 lines each (see `decideCase`).
4. **List view** — `src/app/refunds/page.tsx`, copied from `src/app/cases/page.tsx`: wrap
   the query in `guard("refund:list", ...)`, which logs the list read.
5. **Detail view** — `src/app/refunds/[id]/page.tsx`, copied from
   `src/app/cases/[id]/page.tsx`: `guard("refund:read", ...)` logs the read, masked fields
   come from `maskUnlessRevealed`, and the reveal form posts a reason.
6. **Audit trail** — nothing to build: `auditTrailFor("Refund", id)` renders it and
   `/audit` picks up the new actions automatically.

The audit, masking, and permission plumbing is never rewritten per app — it is four
imports. That is why app #4 is days, not weeks, and why a feature-flag admin panel is a
smaller job than this KYC queue was.

## The kernel (`src/kernel/`)

For your engineers, the whole thing is six files:

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

Stack: Next.js App Router, TypeScript, Prisma, SQLite, Tailwind. Nothing else.

## Evidence (`tests/kernel.test.ts`)

Exactly two tests, deliberately — they assert the two claims a regulator would probe:

- a role without permission is denied a state-changing action (and the denial is audited);
- audit rows cannot be updated or deleted — through Prisma **or** raw SQL.

The full flow was also verified by driving the running app in a browser as each of the
three roles; see the verification comment on the pull request that introduced this PoC.

## What this is NOT

Skipped on purpose inside a 2-hour box. Before this replaces a paid platform in a
regulated fintech, you would need:

- **Real IdP/SSO** with MFA and group-mapped roles. `session.ts` is a cookie stub with a
  visible role switcher — anyone can become an admin.
- **Postgres** (or equivalent), migrations reviewed and run in CI, backups, PITR. SQLite
  here is a single local file.
- **Tamper-evident / WORM audit storage** — hash chaining or append-only object storage
  with retention locks, shipped off the transactional database. Triggers and a client
  extension stop application bugs, not a DBA with write access.
- **Data retention & deletion policy** (including how "append-only audit" coexists with
  erasure requests), plus classification of which fields are PII.
- **Secrets management** — no `.env` in git; KMS/secret manager, rotated credentials.
  (This repo commits a `.env` containing only a local SQLite path, on purpose, so the PoC
  runs with one command.)
- **Monitoring, alerting, on-call**, structured logs, and audit-log anomaly detection.
- **Accessibility review** (WCAG), keyboard navigation, screen-reader labels — the UI is
  plain Tailwind and was not reviewed.
- **Penetration testing / threat model**, CSRF and rate-limit review, input validation at
  the boundary (no Zod here), and authorisation tests far beyond the two included.
- Concurrency control (two approvers acting at once), pagination, search, bulk actions,
  case history/comments, notifications, exports.
- A story for **non-engineer app owners**, if business users currently build these apps
  themselves.

## What was harder or more ambiguous than expected

Worth reading, because these are the decisions your team would inherit rather than
receive from a vendor:

- **"Log reads" is easy; deciding what counts as a read is not.** A list view exposes 25
  applicant names — is that 1 read or 25? This logs one `case.list` row with the filters
  and result count, plus one `case.read` per detail open. A regulator might want row-level
  list logging; that is a volume/usefulness trade-off worth an explicit decision.
- **Reveal-with-reason needs a duration.** "Revealed" is not a moment, it is a window.
  This uses a 5-minute grant per case, so re-revealing after expiry forces a new reason.
  Re-opening during the window logs `case.read` with `piiRevealed: true` rather than a
  second reveal row.
- **Approver ≠ requester needs a definition of "requester".** A KYC queue has no explicit
  requester, so it is bound to `movedToReviewById` — the analyst who moved the case into
  review — stamped on the case at that moment rather than derived from the audit log at
  decision time.
- **Append-only is only as strong as its weakest layer.** The Prisma extension alone is
  application-level etiquette; the SQLite triggers are what make the claim honest, and
  they need a hand-written migration because Prisma does not model triggers.
- Known PoC artefact: under React's development double-rendering, a single page load can
  write several `case.read` rows. Production would log once per request.

`DEVIN_SESSION.md` records the original brief, the plan, every judgment call, and the
mistakes made and corrected while building this — deliberately unedited, so you can judge
the process and not just the output.
