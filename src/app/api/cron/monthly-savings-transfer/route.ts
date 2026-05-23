// Monthly auto-transfer for savings configured with
// transferMode = 'monthly_fixed'. Runs on the 1st of every month at ~03:00
// Europe/Copenhagen (scheduled by Coolify). Inserts one savings_transaction
// per active savings for the current calendar month and bumps the savings
// balance. Idempotent within a calendar month: re-running on the same
// month is a no-op.
//
// The parent financial_account.balance is NOT touched — savings only
// affect the visual balance.

import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";

import { env } from "~/env";
import { db } from "~/server/db";
import { savings, savingsTransaction } from "~/server/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  if (!env.CRON_SECRET) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${env.CRON_SECRET}`;
}

function firstOfMonth(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function lastOfMonth(now: Date): string {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  );
  return next.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const monthFrom = firstOfMonth(now);
  const monthTo = lastOfMonth(now);

  let transferred = 0;
  let skipped = 0;

  await db.transaction(async (tx) => {
    const active = await tx
      .select()
      .from(savings)
      .where(
        and(
          eq(savings.transferMode, "monthly_fixed"),
          eq(savings.archived, false),
          isNull(savings.pausedAt),
        ),
      );

    for (const row of active) {
      if (!row.monthlyAmount || row.monthlyAmount <= 0) {
        skipped += 1;
        continue;
      }

      const [existing] = await tx
        .select({ id: savingsTransaction.id })
        .from(savingsTransaction)
        .where(
          and(
            eq(savingsTransaction.savingsId, row.id),
            eq(savingsTransaction.source, "monthly_auto"),
            gte(savingsTransaction.date, monthFrom),
            lte(savingsTransaction.date, monthTo),
          ),
        );

      if (existing) {
        skipped += 1;
        continue;
      }

      await tx.insert(savingsTransaction).values({
        savingsId: row.id,
        accountId: row.accountId,
        familyId: row.familyId,
        amount: row.monthlyAmount,
        source: "monthly_auto",
        date: monthFrom,
      });

      const [updated] = await tx
        .update(savings)
        .set({
          balance: sql`${savings.balance} + ${row.monthlyAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(savings.id, row.id))
        .returning({
          balance: savings.balance,
          targetAmount: savings.targetAmount,
          completedAt: savings.completedAt,
        });

      if (
        updated &&
        !updated.completedAt &&
        updated.balance >= updated.targetAmount
      ) {
        const stamp = new Date();
        await tx
          .update(savings)
          .set({
            completedAt: stamp,
            pausedAt: stamp,
            updatedAt: stamp,
          })
          .where(eq(savings.id, row.id));
      }

      transferred += 1;
    }
  });

  return NextResponse.json({
    month: monthFrom,
    transferred,
    skipped,
  });
}

export const GET = POST;
