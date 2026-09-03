import type {
  NormalizedBillingEvent,
  NormalizedCustomer,
  NormalizedOrder,
  NormalizedSubscription,
} from "@invoicey/db";

import { offerKeyForProductId, type PolarProductMap } from "./catalog-map";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  /** SAFETY: object and not-array already checked; Polar payloads are JSON objects. */
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asDate(value: unknown): Date | null {
  const raw = asString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nestedId(parent: Record<string, unknown>, key: string): string | null {
  const direct = asString(parent[`${key}_id`]) ?? asString(parent[`${key}Id`]);
  if (direct) return direct;
  const nested = asRecord(parent[key]);
  return nested ? asString(nested.id) : null;
}

function readCustomer(
  payload: Record<string, unknown>,
): NormalizedCustomer | null {
  const customer = asRecord(payload.customer) ?? payload;
  const providerCustomerId = asString(customer.id);
  const externalId =
    asString(customer.external_id) ?? asString(customer.externalId);
  if (!providerCustomerId || !externalId) return null;
  return { providerCustomerId, externalId };
}

function readProductId(payload: Record<string, unknown>): string | null {
  return (
    asString(payload.product_id) ??
    asString(payload.productId) ??
    nestedId(payload, "product")
  );
}

function readSubscription(
  payload: Record<string, unknown>,
  products: PolarProductMap,
  customer: NormalizedCustomer,
): NormalizedSubscription | null {
  const productId = readProductId(payload);
  const offerKey = productId ? offerKeyForProductId(products, productId) : null;
  const providerSubscriptionId = asString(payload.id);
  if (!productId || !offerKey || !providerSubscriptionId) return null;
  return {
    providerSubscriptionId,
    providerProductId: productId,
    offerKey,
    status: asString(payload.status) ?? "unknown",
    cancelAtPeriodEnd: asBoolean(
      payload.cancel_at_period_end ?? payload.cancelAtPeriodEnd,
    ),
    currentPeriodStart: asDate(
      payload.current_period_start ?? payload.currentPeriodStart,
    ),
    currentPeriodEnd: asDate(
      payload.current_period_end ?? payload.currentPeriodEnd,
    ),
    endsAt: asDate(payload.ends_at ?? payload.endsAt),
    endedAt: asDate(payload.ended_at ?? payload.endedAt),
    modifiedAt: asDate(payload.modified_at ?? payload.modifiedAt),
    customer,
  };
}

function readOrder(
  payload: Record<string, unknown>,
  products: PolarProductMap,
): NormalizedOrder | null {
  const customer = readCustomer(payload);
  const productId = readProductId(payload);
  const offerKey = productId ? offerKeyForProductId(products, productId) : null;
  const providerOrderId = asString(payload.id);
  if (!customer || !productId || !offerKey || !providerOrderId) return null;

  const subscriptionPayload = asRecord(payload.subscription);
  const subscription = subscriptionPayload
    ? readSubscription(subscriptionPayload, products, customer)
    : null;

  return {
    providerOrderId,
    providerProductId: productId,
    offerKey,
    billingReason:
      asString(payload.billing_reason) ??
      asString(payload.billingReason) ??
      "purchase",
    amount: asNumber(payload.amount) ?? 0,
    currency: asString(payload.currency) ?? "czk",
    refundedAmount:
      asNumber(payload.refunded_amount) ??
      asNumber(payload.refundedAmount) ??
      0,
    checkoutId: asString(payload.checkout_id) ?? asString(payload.checkoutId),
    status: asString(payload.status) ?? "paid",
    customer,
    subscription: subscription ?? undefined,
  };
}

const SUBSCRIPTION_EVENTS = new Set([
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.canceled",
  "subscription.uncanceled",
  "subscription.past_due",
  "subscription.revoked",
]);

const CUSTOMER_EVENTS = new Set([
  "customer.created",
  "customer.updated",
  "customer.state_changed",
]);

export function normalizePolarEvent(
  eventType: string,
  data: unknown,
  products: PolarProductMap,
): NormalizedBillingEvent {
  const payload = asRecord(data);
  if (!payload) return { kind: "ignored" };

  if (eventType === "order.paid") {
    const order = readOrder(payload, products);
    return order ? { kind: "order.paid", order } : { kind: "ignored" };
  }

  if (eventType === "order.refunded") {
    const order = readOrder(payload, products);
    return order ? { kind: "order.refunded", order } : { kind: "ignored" };
  }

  if (eventType === "refund.updated") {
    if (asString(payload.status) !== "succeeded") return { kind: "ignored" };
    const orderPayload = asRecord(payload.order);
    if (!orderPayload) return { kind: "ignored" };
    const order = readOrder(orderPayload, products);
    return order ? { kind: "order.refunded", order } : { kind: "ignored" };
  }

  if (SUBSCRIPTION_EVENTS.has(eventType)) {
    const customer = readCustomer(payload);
    if (!customer) return { kind: "ignored" };
    const subscription = readSubscription(payload, products, customer);
    return subscription
      ? { kind: "subscription.snapshot", subscription }
      : { kind: "ignored" };
  }

  if (CUSTOMER_EVENTS.has(eventType)) {
    const customer = readCustomer(payload);
    return customer
      ? { kind: "customer.upsert", customer }
      : { kind: "ignored" };
  }

  return { kind: "ignored" };
}
