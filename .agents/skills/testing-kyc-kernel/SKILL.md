---
name: testing-kyc-kernel
description: How to run and adversarially test the internal-tools kernel PoC + KYC review queue (Next.js + Prisma + SQLite) locally.
---

# Testing the KYC review queue / kernel PoC

## Run it
```bash
npm install && npm run db:seed && npm run dev   # http://localhost:3000
```
- No auth, no external services, no secrets required. SQLite lives at `prisma/dev.db`.
- Do NOT run `pkill -f "next dev"` from the agent shell — the pattern matches the shell's own
  command line and kills your session. Use `fuser -k 3000/tcp` or `pkill -f next-server` instead.
- Inspect/choose fixtures without a GUI:
  `python3 -c "import sqlite3;print(sqlite3.connect('prisma/dev.db').execute('select reference,id,status,movedToReviewById from \"Case\"').fetchall())"`
  (`sqlite3` CLI may not be installed; python3 + sqlite3 module works.)

## Reaching the feature
- Role switching: the `Acting as (demo stub)` select in the header + `Switch` button (cookie `poc_actor_id`).
  Known cosmetic quirk: right after switching, the select label can still show the previous user
  even though the nav/permissions already reflect the new one; a page reload fixes the label.
- Case detail URL: `/cases/<cuid>` (grab ids from the DB or the `Open` links on `/cases`).
- `/audit` is admin-only; the nav link only renders for admins.

## Adversarial techniques that work here
- Client-side `required` fields (PII reveal reason, decision reason) are bypassed by typing
  whitespace — the server trims and rejects, which is what you actually want to prove.
- To prove server-side RBAC (not just hidden UI): render an approver's decide form in tab A,
  switch the role to an analyst in tab B (shared cookie), then submit tab A's form. Expect
  `Role "analyst" is not permitted to perform "case:approve"` and an `access.denied` audit row.
- Separation of duties: an admin (has both `case:start_review` and `case:approve`) moving a
  pending case into review and then deciding it is the cleanest single-user SoD repro.
- Expected noise: denied page loads log `ForbiddenError` to the dev server log and the browser
  console; they are caught by `src/app/error.tsx` ("Request blocked") and are not crashes.
- Each page load can write several `case.read`/`case.list` rows (React dev double-render);
  assert "count grew", not an exact count.

## Devin Secrets Needed
None.
