import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { env } from "~/env";
import { applySubscriptionUpdate } from "~/server/billing/lifecycle";
import { getStripe } from "~/server/billing/stripe";
import { db } from "~/server/db";
import { familySubscription, stripeWebhookEvent } from "~/server/db/schema";
import { eq } from "drizzle-orm";

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

async function recordEvent(event: Stripe.Event): Promise<boolean> {
  try {
    await db.insert(stripeWebhookEvent).values({
      id: event.id,
      type: event.type,
    });
    return true;
  } catch {
    // duplicate primary key → already processed
    return false;
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
      { status: 500 },
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

  const fresh = await recordEvent(event);
  if (!fresh) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const familyId = session.client_reference_id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        if (!familyId || !subscriptionId) break;

        if (customerId) {
          await db
            .update(familySubscription)
            .set({ stripeCustomerId: customerId, updatedAt: new Date() })
            .where(eq(familySubscription.familyId, familyId));
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await applySubscriptionUpdate({ db, subscription, familyId });
        break;
      }

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
          break;
        }
        await applySubscriptionUpdate({ db, subscription, familyId });
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subscriptionField = (
          invoice as unknown as {
            subscription?: string | { id: string } | null;
            parent?: {
              subscription_details?: {
                subscription?: string | { id: string } | null;
              };
            };
          }
        ).subscription ??
          (
            invoice as unknown as {
              parent?: {
                subscription_details?: {
                  subscription?: string | { id: string } | null;
                };
              };
            }
          ).parent?.subscription_details?.subscription;
        const subscriptionId =
          typeof subscriptionField === "string"
            ? subscriptionField
            : subscriptionField?.id;
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const familyId = await findFamilyIdForSubscription(subscription);
        if (!familyId) break;
        await applySubscriptionUpdate({ db, subscription, familyId });
        break;
      }

      default:
        // Ignore other events.
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler failed", event.type, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
