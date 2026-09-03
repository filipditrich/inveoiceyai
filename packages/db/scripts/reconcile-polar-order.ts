/**
 * Manually replay a Polar `order.paid` effect for one workspace.
 *
 * Use when Polar never delivered (or never sent) the `order.paid` webhook for
 * a real order — e.g. the endpoint's subscribed-events list was missing
 * `order.paid` — and a workspace paid but never got its plan/tokens. Runs the
 * exact same `applyNormalizedBillingEvent` path the webhook route uses, so
 * results (idempotency, token math, plan assignment) match production.
 *
 *   bun run --cwd packages/db scripts/reconcile-polar-order.ts \
 *     --workspace=<id> --offer=tokens_small --order-id=<polar-order-id> \
 *     [--product-id=<polar-product-id>] [--amount=0] [--currency=czk] \
 *     [--checkout-id=<id>] [--billing-reason=purchase] [--apply]
 *
 * Dry run by default. `--order-id` should be the real Polar order id when
 * known (check the customer's Orders in the Polar dashboard or their receipt
 * email) so this stays a truthful, idempotent record — the unique constraint
 * on `provider_order_id` also means a genuinely later webhook for the same
 * order becomes a safe no-op duplicate instead of double-crediting.
 */
import "@invoicey/env/load";
import { eq } from "drizzle-orm";

import { aiTokenBalances } from "../src/ai-usage";
import {
  applyNormalizedBillingEvent,
  claimWebhookEvent,
  finishWebhookEvent,
  type NormalizedOrder,
} from "../src/billing-repo";
import {
  BILLING_OFFER_KEYS,
  isBillingOfferKey,
  type BillingOfferKey,
} from "../src/billing-rules";
import { billingCustomers } from "../src/billing-schema";
import { createDb } from "../src/create-db";
import { withDbTransaction } from "../src/transaction";
import { workspaces } from "../src/workspaces";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function productIdFromEnv(offerKey: BillingOfferKey): string | undefined {
  const envKey = `POLAR_PRODUCT_${offerKey.toUpperCase()}`;
  return process.env[envKey]?.trim() || undefined;
}

const workspaceId = arg("workspace");
const offerArg = arg("offer");
const orderId = arg("order-id");
const productIdArg = arg("product-id");
const amount = Number(arg("amount") ?? "0");
const currency = (arg("currency") ?? "czk").toLowerCase();
const checkoutId = arg("checkout-id") ?? null;
const billingReason = arg("billing-reason") ?? "purchase";
const apply = flag("apply");

if (!workspaceId) fail("--workspace=<id> is required");
if (!offerArg || !isBillingOfferKey(offerArg)) {
  fail(`--offer=<key> is required, one of: ${BILLING_OFFER_KEYS.join(", ")}`);
}
if (!orderId) {
  fail(
    "--order-id=<polar-order-id> is required. Find it in the customer's " +
      "Orders in the Polar dashboard or their receipt email — do not invent one.",
  );
}
const offerKey: BillingOfferKey = offerArg;

const url = process.env.DATABASE_URL?.trim();
if (!url) fail("DATABASE_URL is empty");
const db = createDb(url);

const [workspace] = await db
  .select({ id: workspaces.id, name: workspaces.name })
  .from(workspaces)
  .where(eq(workspaces.id, workspaceId))
  .limit(1);
if (!workspace) fail(`No workspace ${workspaceId}`);

const [customer] = await db
  .select()
  .from(billingCustomers)
  .where(eq(billingCustomers.workspaceId, workspaceId))
  .limit(1);
if (!customer) {
  fail(
    `No billing_customers row for workspace ${workspaceId}. Sync the Polar ` +
      "customer first (a customer.created/customer.state_changed webhook) " +
      "so this script has a provider_customer_id to attach the order to.",
  );
}

const productId = productIdArg ?? productIdFromEnv(offerKey);
if (!productId) {
  fail(
    `--product-id=<id> is required (or set POLAR_PRODUCT_${offerKey.toUpperCase()} in the environment)`,
  );
}

const order: NormalizedOrder = {
  providerOrderId: orderId,
  providerProductId: productId,
  offerKey,
  billingReason,
  amount,
  currency,
  refundedAmount: 0,
  checkoutId,
  status: "paid",
  customer: {
    providerCustomerId: customer.providerCustomerId,
    externalId: customer.providerExternalId,
  },
};

console.log(`\nworkspace     ${workspace.id} (${workspace.name})`);
console.log(`offer         ${offerKey}`);
console.log(`order id      ${orderId}`);
console.log(`product id    ${productId}`);
console.log(`amount        ${amount} ${currency}`);

const [before] = await db
  .select()
  .from(aiTokenBalances)
  .where(eq(aiTokenBalances.workspaceId, workspaceId))
  .limit(1);
if (before) {
  console.log(
    `purchased before ${before.purchasedRemaining} (monthly ${before.monthlyRemaining}, gifted ${before.giftedRemaining})`,
  );
}

if (!apply) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to commit.");
  process.exit(0);
}

const providerEventId = `manual-reconcile:${orderId}`;
const result = await withDbTransaction(async (tx) => {
  const claimed = await claimWebhookEvent(tx, {
    providerEventId,
    eventType: "manual.order.paid",
    payload: {
      note: "Backfilled via reconcile-polar-order.ts — Polar order.paid was never delivered.",
      order,
    },
  });
  if (claimed.outcome === "duplicate") {
    return { duplicate: true as const };
  }
  const applied = await applyNormalizedBillingEvent(tx, {
    environment: "production",
    event: { kind: "order.paid", order },
  });
  await finishWebhookEvent(tx, {
    eventId: claimed.eventId,
    state: applied.applied ? "processed" : "ignored",
  });
  return { duplicate: false as const, ...applied };
});

if (result.duplicate) {
  console.log(
    `\nAlready reconciled — ${providerEventId} was previously claimed. No change.`,
  );
  process.exit(0);
}

const [after] = await db
  .select()
  .from(aiTokenBalances)
  .where(eq(aiTokenBalances.workspaceId, workspaceId))
  .limit(1);
console.log(`\nApplied (${result.reason}).`);
if (after) {
  console.log(
    `purchased after  ${after.purchasedRemaining} (monthly ${after.monthlyRemaining}, gifted ${after.giftedRemaining})`,
  );
}
