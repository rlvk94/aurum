import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";

import { env } from "~/env";
import { applySubscriptionUpdate } from "~/server/billing/lifecycle";
import { getStripe } from "~/server/billing/stripe";
import { db } from "~/server/db";
import { familySubscription, stripeWebhookEvent } from "~/server/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findFamilyIdForSubscription(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = subscription.metadata?.familyId;
  if (typeof fromMetadata === "string" && fromMetadata.length > 0) {
    return fromMetadata;
  }
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const [row] = await db
    .select({ familyId: familySubscription.familyId })
    .from(familySubscription)
    .where(eq(familySubscription.stripeCustomerId, customerId));
  return row?.familyId ?? null;
}

function extractSubscriptionId(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as {
    subscription?: string | { id: string } | null;
    parent?: {
      subscription_details?: {
        subscription?: string | { id: string } | null;
      } | null;
      subscription?: string | { id: string } | null;
    } | null;
  };

  const candidate =
    inv.subscription ??
    inv.parent?.subscription_details?.subscription ??
    inv.parent?.subscription;

  if (!candidate) return null;
  return typeof candidate === "string" ? candidate : candidate.id;
}

async function alreadyProcessed(eventId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: stripeWebhookEvent.id })
    .from(stripeWebhookEvent)
    .where(eq(stripeWebhookEvent.id, eventId));
  return Boolean(row);
}

async function markProcessed(event: Stripe.Event): Promise<void> {
  try {
    await db.insert(stripeWebhookEvent).values({
      id: event.id,
      type: event.type,
    });
  } catch {
    // Concurrent delivery already inserted — fine.
  }
}

async function dispatch(event: Stripe.Event, stripe: Stripe): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const familyId = await findFamilyIdForSubscription(subscription);
      if (!familyId) {
        console.warn(
          "[stripe-webhook] could not resolve familyId",
          event.type,
          subscription.id,
        );
        return;
      }
      await applySubscriptionUpdate({ db, subscription, familyId });
      return;
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subscriptionId = extractSubscriptionId(invoice);
      if (!subscriptionId) return;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const familyId = await findFamilyIdForSubscription(subscription);
      if (!familyId) return;
      await applySubscriptionUpdate({ db, subscription, familyId });
      return;
    }

    default:
      // Other events ignored — only the lifecycle ones are meaningful.
      return;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Idempotency: skip if we've already finished processing this event id.
  if (await alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await dispatch(event, stripe);
  } catch (err) {
    console.error("[stripe-webhook] handler failed", event.type, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  // Only mark processed after the handler succeeds. A failed handler returns
  // 500 above, so Stripe will retry and we'll redo the work next time.
  await markProcessed(event);

  return NextResponse.json({ received: true });
}
