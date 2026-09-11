import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";

import { buildApnsJwt, buildApnsPayload } from "./apns";

describe("APNs notification adapter", () => {
  it("builds an alert that deep-links to the durable notification", () => {
    expect(
      buildApnsPayload({
        notificationId: "delivery-1",
        title: "Platba přijata",
        body: "Přijato 500,00 Kč.",
        actionPath: "/payments/requests/request-1",
        category: "payment_received",
      }),
    ).toEqual({
      aps: {
        alert: { title: "Platba přijata", body: "Přijato 500,00 Kč." },
        sound: "default",
        category: "payment_received",
        "thread-id": "payments",
      },
      notificationId: "delivery-1",
      actionPath: "/payments/requests/request-1",
    });
  });

  it("signs a provider token with the configured team and key ids", () => {
    const { privateKey } = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const token = buildApnsJwt({
      keyId: "KEY123",
      teamId: "TEAM123",
      privateKey: privateKey
        .export({ type: "pkcs8", format: "pem" })
        .toString(),
      issuedAt: 1_789_000_000,
    });
    const [header, claims, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(header!, "base64url").toString())).toEqual({
      alg: "ES256",
      kid: "KEY123",
    });
    expect(JSON.parse(Buffer.from(claims!, "base64url").toString())).toEqual({
      iss: "TEAM123",
      iat: 1_789_000_000,
    });
    expect(Buffer.from(signature!, "base64url")).toHaveLength(64);
  });
});
