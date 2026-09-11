import { createPrivateKey, sign } from "node:crypto";
import { connect } from "node:http2";
import { z } from "zod";

export type ApnsAlert = {
  notificationId: string;
  title: string;
  body: string;
  actionPath: string;
  category: string;
};

export type ApnsConfiguration = {
  keyId: string;
  teamId: string;
  privateKey: string;
  topic: string;
  environment: "sandbox" | "production";
};

export type ApnsSendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; reason: string; permanent: boolean };

type ApnsJwtPart = { alg: "ES256"; kid: string } | { iss: string; iat: number };

function encoded(value: ApnsJwtPart): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function buildApnsJwt(input: {
  keyId: string;
  teamId: string;
  privateKey: string;
  issuedAt?: number;
}): string {
  const header = encoded({ alg: "ES256", kid: input.keyId });
  const claims = encoded({
    iss: input.teamId,
    iat: input.issuedAt ?? Math.floor(Date.now() / 1000),
  });
  const signingInput = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(input.privateKey),
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return `${signingInput}.${signature}`;
}

export function buildApnsPayload(alert: ApnsAlert) {
  return {
    aps: {
      alert: { title: alert.title, body: alert.body },
      sound: "default",
      category: alert.category,
      "thread-id": "payments",
    },
    notificationId: alert.notificationId,
    actionPath: alert.actionPath,
  };
}

function apnsOrigin(environment: ApnsConfiguration["environment"]): string {
  return environment === "sandbox"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
}

function permanentApnsFailure(status: number, reason: string): boolean {
  return (
    status === 410 ||
    reason === "BadDeviceToken" ||
    reason === "DeviceTokenNotForTopic"
  );
}

/** Send one alert through Apple's token-authenticated HTTP/2 interface. */
export async function sendApnsNotification(input: {
  configuration: ApnsConfiguration;
  deviceToken: string;
  alert: ApnsAlert;
}): Promise<ApnsSendResult> {
  const jwt = buildApnsJwt(input.configuration);
  const client = connect(apnsOrigin(input.configuration.environment));
  const body = JSON.stringify(buildApnsPayload(input.alert));
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: ApnsSendResult) => {
      if (settled) return;
      settled = true;
      client.close();
      resolve(result);
    };
    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${input.deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": input.configuration.topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-collapse-id": input.alert.notificationId,
      "content-type": "application/json",
    });
    let status = 0;
    let responseBody = "";
    let providerMessageId: string | null = null;
    request.setEncoding("utf8");
    request.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
      const header = headers["apns-id"];
      providerMessageId = Array.isArray(header)
        ? (header[0] ?? null)
        : (header ?? null);
    });
    request.on("data", (chunk: string) => {
      responseBody += chunk;
    });
    request.on("error", (error) => {
      finish({ ok: false, reason: error.message, permanent: false });
    });
    request.on("end", () => {
      if (status === 200) {
        finish({ ok: true, providerMessageId });
        return;
      }
      let reason = `apns_${status || "unknown"}`;
      try {
        const parsed = z
          .object({ reason: z.string().optional() })
          .safeParse(JSON.parse(responseBody));
        if (parsed.success && parsed.data.reason) reason = parsed.data.reason;
      } catch {
        /** APNs may return an empty body for infrastructure failures. */
      }
      finish({
        ok: false,
        reason,
        permanent: permanentApnsFailure(status, reason),
      });
    });
    request.end(body);
  });
}
