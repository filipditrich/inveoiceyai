import { describe, expect, it } from "vitest";

import { normalizePolarEvent } from "./normalize";

const products = {
  pro_monthly: "prod_month",
  pro_yearly: "prod_year",
  tokens_small: "prod_s",
  tokens_medium: "prod_m",
  tokens_large: "prod_l",
};

const customer = {
  id: "cus_1",
  external_id: "11111111-1111-4111-8111-111111111111",
};

describe("normalizePolarEvent", () => {
  it("reads a paid token-pack order", () => {
    const event = normalizePolarEvent(
      "order.paid",
      {
        id: "ord_1",
        status: "paid",
        billing_reason: "purchase",
        product_id: "prod_s",
        amount: 49000,
        currency: "czk",
        refunded_amount: 0,
        customer,
      },
      products,
    );
    expect(event.kind).toBe("order.paid");
    if (event.kind !== "order.paid") return;
    expect(event.order.offerKey).toBe("tokens_small");
    expect(event.order.customer.externalId).toBe(customer.external_id);
  });

  it("ignores unknown products and missing workspace ids", () => {
    expect(
      normalizePolarEvent(
        "order.paid",
        { id: "ord_1", product_id: "prod_other", customer },
        products,
      ).kind,
    ).toBe("ignored");
    expect(
      normalizePolarEvent(
        "order.paid",
        { id: "ord_1", product_id: "prod_s", customer: { id: "cus_1" } },
        products,
      ).kind,
    ).toBe("ignored");
  });

  it("upserts Polar customer identity without touching the workspace plan", () => {
    const event = normalizePolarEvent("customer.updated", customer, products);
    expect(event.kind).toBe("customer.upsert");
    if (event.kind !== "customer.upsert") return;
    expect(event.customer).toEqual({
      providerCustomerId: customer.id,
      externalId: customer.external_id,
    });
  });

  it("snapshots a past_due subscription and ignores pending refunds", () => {
    const snapshot = normalizePolarEvent(
      "subscription.past_due",
      {
        id: "sub_1",
        status: "past_due",
        product_id: "prod_month",
        cancel_at_period_end: false,
        customer,
      },
      products,
    );
    expect(snapshot.kind).toBe("subscription.snapshot");
    expect(
      normalizePolarEvent(
        "refund.updated",
        {
          status: "pending",
          order: { id: "ord_1", product_id: "prod_s", customer },
        },
        products,
      ).kind,
    ).toBe("ignored");
  });
});
