# Session record

## The prompt I was given

> Build a time-boxed proof of concept: a small "internal tools kernel" for a fintech
> engineering team, plus ONE app built on it. This is a 2-HOUR PoC for a build-vs-buy
> evaluation, NOT production. Do not gold-plate. Hard stop at 2 hours: if something is
> unfinished, stop and document it rather than continuing.
>
> STACK (do not deviate, do not add services): Next.js App Router + TypeScript + Prisma +
> SQLite + Tailwind. Must run with `npm install && npm run db:seed && npm run dev`. No
> Docker, no external services, no cloud dependencies, no auth provider.
>
> CONTEXT: the client already pays for Microsoft Power Apps. Power Apps gives them RBAC
> and CRUD out of the box, but it does NOT log record READS by default, does NOT natively
> enforce approver != requester, and its PII masking is partial. This PoC exists to show
> what a code-first internal-tools kernel gives that the low-code platform does not.
>
> P1 — THE KERNEL (own directory): session auth stub with three roles (analyst, approver,
> admin) and a role switcher; declarative RBAC in ONE config object enforced by one
> middleware/helper; append-only audit log that records READS (actor, action, target,
> timestamp, reason) with no update/delete path at the data layer; PII masking helper
> where revealing requires a reason and the reveal is audited.
>
> P2 — ONE APP: a KYC review queue. Cases with pending/in_review/approved/rejected; list
> view with status and assignee filters; detail view with masked PII and
> reveal-with-reason; approve/reject requires a free-text reason; approver != the analyst
> who moved the case into review; analysts cannot act outside their role; admin can
> reassign; ~25 rows of obviously fake seed data, no real PII ever.
>
> P3 — EVIDENCE (only if P1 and P2 are done): ONE test file covering exactly two things —
> (a) a role without permission is denied a state-changing action, (b) audit rows cannot
> be updated or deleted. Nothing else.
>
> README covering: what it is and how to run it; how to add the next internal app on this
> kernel referencing real files; "what this is NOT" (real IdP/SSO, Postgres, WORM audit,
> retention, secrets management, monitoring, accessibility, pentest); and a note on what
> was harder or more ambiguous than expected.
>
> WORKING STYLE: clean incremental commits; a status update at ~60 minutes; write
> DEVIN_SESSION.md with the prompt, the plan, the decisions I had to make alone, and
> anything I got wrong and corrected; if a requirement is ambiguous, pick the simplest
> interpretation serving the thesis, implement it, and record the assumption.
>
> FINAL REPORT: what I built, what I skipped, judgment calls, and what I would do next
> with two more hours.

## The plan I made

1. Scaffold Next.js + TS + Tailwind + Prisma/SQLite; get `npm run db:seed` working.
2. P1 kernel in `src/kernel/`: `rbac.ts`, `guard.ts`, `audit.ts`, `db.ts`, `pii.ts`,
   `session.ts`. Commit.
3. P2 KYC app in `src/app/`: list, detail, server actions, seed of 25 fake cases. Commit.
4. P3: one test file, two tests. Commit.
5. README + this file. Commit, push, PR.

All tiers (P1, P2, P3) were completed.

## Decisions I made on my own

- **Where "requester" comes from.** A KYC case has no explicit requester, so
  approver ≠ requester is enforced against `Case.movedToReviewById` — the analyst who
  moved the case into review — stored on the case at that transition rather than derived
  from the audit log at decision time. Simplest interpretation that still demonstrates
  separation of duties.
- **What counts as a read.** One `case.read` row per detail-page open, and one
  `case.list` row per list query (recording the filters and result count) rather than one
  row per listed record. Row-level list logging would be more defensible to a regulator
  but is noise in a PoC.
- **Reveal is a window, not an instant.** A reveal grants 5 minutes for that one case via
  a cookie holding the reason; expiry forces a fresh reason. Views during the window are
  logged as `case.read` with `piiRevealed: true`.
- **Append-only enforced twice.** Prisma client extension blocks
  `update/updateMany/upsert/delete/deleteMany` on `AuditLog`; hand-written SQLite triggers
  (`prisma/migrations/*_audit_append_only`) block the same via raw SQL. Prisma cannot
  model triggers, so that migration is written by hand.
- **`.env` is committed** (it contains only `DATABASE_URL="file:./dev.db"`) so the three
  documented commands work on a clean clone. Called out in the README as something
  production must not do.
- **Denials are audited too** (`access.denied`), which was not asked for but costs three
  lines in `guard.ts` and is directly on-thesis.
- **Admin has every permission** including approve/reject; only admin can reassign and
  read `/audit`.
- **Next.js 15.4.7 instead of the create-next-app default 15.1.6** — the scaffolded
  version carries a published security advisory.

## Things I got wrong and corrected

- Exported a non-async helper (`revealCookie`) from a `"use server"` file, which Next
  rejects — moved it to `src/app/reveal.ts`.
- Initially planned to enforce append-only only in the Prisma extension. That is
  application etiquette, not a data-layer guarantee, so I added the SQLite triggers and
  the test now asserts raw SQL is blocked too.
- Left the create-next-app dark-mode CSS variables in `globals.css`, which fought the
  explicit Tailwind colours on `<body>`; reduced the file to the three Tailwind
  directives.

## Time

Well inside the 2-hour box; no tier was cut. The remaining risk is not scope, it is that
the pieces production needs (real IdP, WORM audit, Postgres) are listed rather than
built — see "What this is NOT" in the README.
