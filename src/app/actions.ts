"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/kernel/db";
import { logAudit } from "@/kernel/audit";
import { guard } from "@/kernel/guard";
import { ForbiddenError } from "@/kernel/rbac";
import { SESSION_COOKIE } from "@/kernel/session";
import { revealCookie } from "./reveal";

export async function switchActor(formData: FormData) {
  const actorId = String(formData.get("actorId") ?? "");
  const store = await cookies();
  store.set(SESSION_COOKIE, actorId, { path: "/" });
  revalidatePath("/", "layout");
}

/** Wraps a guarded action so ForbiddenError surfaces as a UI message, not a crash. */
async function run(path: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    }
    if (error instanceof Error && error.name === "WorkflowError") {
      redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  redirect(path);
}

class WorkflowError extends Error {
  name = "WorkflowError";
}

export async function revealPii(formData: FormData) {
  const caseId = String(formData.get("caseId"));
  const reason = String(formData.get("reason") ?? "").trim();
  const path = `/cases/${caseId}`;
  if (!reason) redirect(`${path}?error=${encodeURIComponent("A reason is required to reveal PII")}`);

  await run(path, async () => {
    await guard(
      "case:reveal_pii",
      async (actor) => {
        await logAudit({
          actor,
          action: "case.pii_reveal",
          targetType: "Case",
          targetId: caseId,
          reason,
        });
        const store = await cookies();
        store.set(revealCookie(caseId), reason, { path: "/", maxAge: 300 });
      },
      { type: "Case", id: caseId },
    );
  });
}

export async function startReview(formData: FormData) {
  const caseId = String(formData.get("caseId"));
  const path = `/cases/${caseId}`;

  await run(path, async () => {
    await guard(
      "case:start_review",
      async (actor) => {
        const record = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
        if (record.status !== "pending") {
          throw new WorkflowError(`Case is already ${record.status}`);
        }
        await prisma.case.update({
          where: { id: caseId },
          data: { status: "in_review", assigneeId: actor.id, movedToReviewById: actor.id },
        });
        await logAudit({
          actor,
          action: "case.start_review",
          targetType: "Case",
          targetId: caseId,
        });
      },
      { type: "Case", id: caseId },
    );
  });
}

export async function decideCase(formData: FormData) {
  const caseId = String(formData.get("caseId"));
  const decision = String(formData.get("decision"));
  const reason = String(formData.get("reason") ?? "").trim();
  const path = `/cases/${caseId}`;

  if (decision !== "approved" && decision !== "rejected") {
    redirect(`${path}?error=${encodeURIComponent("Unknown decision")}`);
  }
  if (!reason) {
    redirect(`${path}?error=${encodeURIComponent("A reason is required to decide a case")}`);
  }

  await run(path, async () => {
    await guard(
      decision === "approved" ? "case:approve" : "case:reject",
      async (actor) => {
        const record = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
        if (record.status !== "in_review") {
          throw new WorkflowError("Only cases in review can be decided");
        }
        // Separation of duties: the approver cannot be the analyst who moved
        // the case into review.
        if (record.movedToReviewById && record.movedToReviewById === actor.id) {
          throw new WorkflowError(
            "Separation of duties: you moved this case into review and cannot decide it",
          );
        }
        await prisma.case.update({
          where: { id: caseId },
          data: { status: decision, decisionReason: reason, decidedById: actor.id },
        });
        await logAudit({
          actor,
          action: decision === "approved" ? "case.approve" : "case.reject",
          targetType: "Case",
          targetId: caseId,
          reason,
        });
      },
      { type: "Case", id: caseId },
    );
  });
}

export async function reassignCase(formData: FormData) {
  const caseId = String(formData.get("caseId"));
  const assigneeId = String(formData.get("assigneeId") ?? "");
  const path = `/cases/${caseId}`;

  await run(path, async () => {
    await guard(
      "case:reassign",
      async (actor) => {
        await prisma.case.update({
          where: { id: caseId },
          data: { assigneeId: assigneeId || null },
        });
        await logAudit({
          actor,
          action: "case.reassign",
          targetType: "Case",
          targetId: caseId,
          metadata: { assigneeId },
        });
      },
      { type: "Case", id: caseId },
    );
  });
}
