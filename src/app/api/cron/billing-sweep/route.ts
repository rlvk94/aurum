import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNotNull, lte, or } from "drizzle-orm";

import { env } from "~/env";
import { db } from "~/server/db";
import { familySubscription } from "~/server/db/schema";
import { sendBillingDowngradedEmail } from "~/server/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  if (!env.CRON_SECRET) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${env.CRON_SECRET}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const expired = await db
    .select({ familyId: familySubscription.familyId })
    .from(familySubscription)
    .where(
      and(
        eq(familySubscription.plan, "family"),
        isNotNull(familySubscription.graceEndsAt),
        lte(familySubscription.graceEndsAt, now),
        or(
          eq(familySubscription.status, "past_due"),
          eq(familySubscription.status, "unpaid"),
        ),
      ),
    );

  for (const { familyId } of expired) {
    await db
      .update(familySubscription)
      .set({ plan: "individual", updatedAt: new Date() })
      .where(eq(familySubscription.familyId, familyId));

    await sendBillingDowngradedEmail({ familyId }).catch((err) => {
      console.error("[cron-billing-sweep] downgrade email failed", err);
    });
  }

  return NextResponse.json({ swept: expired.length });
}

export const GET = POST;
