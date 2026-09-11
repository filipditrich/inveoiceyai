import { createStandalonePaymentRequest } from "@/lib/payments/create-payment-request";
import {
  listCollectibleInvoices,
  loadInvoiceCollection,
} from "@/lib/payments/invoice-collection-repository";
import { resolveCollectingAccount } from "@/lib/payments/payment-request-account";
import { loadPaymentRequestCollection } from "@/lib/payments/payment-request-collection";
import { heartbeatWatchAndPoll } from "@/lib/payments/watch-session";
import { requirePocketDevice } from "@/lib/pocket/device-auth";
import { pocketDeviceCan } from "@/lib/pocket/permission";
import {
  PocketRequestSchema,
  type PocketRequest,
} from "@/lib/pocket/request-schema";
import { NextResponse } from "next/server";

import {
  listPaymentRequests,
  listUserNotifications,
  markUserNotificationRead,
  registerPocketPushToken,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" } as const;

function json<ResponseBody extends object>(body: ResponseBody, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function publicUrl(token: string): string {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/u, "")}/pay/${token}`;
}

async function paymentCollection(workspaceId: string, requestId: string) {
  const collection = await loadPaymentRequestCollection(workspaceId, requestId);
  return collection
    ? { ...collection, publicUrl: publicUrl(collection.publicToken) }
    : null;
}

async function watchPayment(workspaceId: string, requestId: string) {
  const before = await loadPaymentRequestCollection(workspaceId, requestId);
  if (!before) return null;
  const poll = before.settled
    ? { polled: false, retryAfterMs: 0 }
    : await heartbeatWatchAndPoll({
        workspaceId,
        connectionId: before.connectionId,
      });
  const collection = await paymentCollection(workspaceId, requestId);
  return collection ? { collection, poll } : null;
}

async function watchInvoice(workspaceId: string, invoiceId: string) {
  const before = await loadInvoiceCollection(workspaceId, invoiceId);
  if (!before) return null;
  const poll = before.settled
    ? { polled: false, retryAfterMs: 0 }
    : await heartbeatWatchAndPoll({
        workspaceId,
        connectionId: before.connectionId,
      });
  const collection = await loadInvoiceCollection(workspaceId, invoiceId);
  return collection ? { collection, poll } : null;
}

type AuthorizedPocketRequest = Exclude<
  PocketRequest,
  { op: "me" } | { op: "device.register_push" }
>;

async function executeAuthorized(
  operation: AuthorizedPocketRequest,
  device: { id: string; userId: string; workspaceId: string; name: string },
) {
  const scope = { userId: device.userId, workspaceId: device.workspaceId };
  const permission =
    operation.op === "payment_requests.list" ||
    operation.op === "payment_requests.get" ||
    operation.op === "invoices.list_unpaid" ||
    operation.op === "notifications.list" ||
    operation.op === "notifications.read"
      ? "payments:read"
      : "payments:manage";
  if (!(await pocketDeviceCan({ ...scope, permission }))) {
    return { error: "forbidden", status: 403 } as const;
  }

  if (operation.op === "notifications.list") {
    return {
      notifications: await listUserNotifications(db, {
        ...scope,
        limit: operation.limit,
      }),
    };
  }
  if (operation.op === "notifications.read") {
    return {
      updated: await markUserNotificationRead(db, {
        ...scope,
        id: operation.notificationId,
      }),
    };
  }

  if (operation.op === "payment_requests.create") {
    const account = await resolveCollectingAccount(device.workspaceId);
    if (!account)
      return { error: "collecting_account_unavailable", status: 409 } as const;
    const request = await createStandalonePaymentRequest({
      workspaceId: device.workspaceId,
      issuerId: account.issuerId,
      bankAccountId: account.bankAccountId,
      iban: account.iban,
      amount: operation.amount,
      message: operation.message,
      createdByUserId: device.userId,
    });
    return {
      collection: await paymentCollection(device.workspaceId, request.id),
    };
  }
  if (operation.op === "payment_requests.list") {
    const requests = await listPaymentRequests(db, device.workspaceId, {
      limit: operation.limit,
      offset: 0,
    });
    return {
      requests: requests.map((request) => ({
        id: request.id,
        amount: request.amount,
        paidAmount: request.allocatedAmount,
        currency: request.currency,
        message: request.message,
        variableSymbol: request.variableSymbol,
        status: request.status,
        publicUrl: publicUrl(request.publicToken),
        createdAt: request.createdAt,
        settledAt: request.settledAt,
      })),
    };
  }
  if (operation.op === "payment_requests.get") {
    const collection = await paymentCollection(
      device.workspaceId,
      operation.requestId,
    );
    return collection
      ? { collection }
      : ({ error: "not_found", status: 404 } as const);
  }
  if (operation.op === "payment_requests.watch") {
    const result = await watchPayment(device.workspaceId, operation.requestId);
    return result ?? ({ error: "not_found", status: 404 } as const);
  }
  if (operation.op === "invoices.list_unpaid") {
    return {
      invoices: await listCollectibleInvoices(
        device.workspaceId,
        operation.limit,
      ),
    };
  }
  if (operation.op === "invoices.collect") {
    const collection = await loadInvoiceCollection(
      device.workspaceId,
      operation.invoiceId,
    );
    return collection
      ? { collection }
      : ({ error: "not_collectible", status: 409 } as const);
  }
  const result = await watchInvoice(device.workspaceId, operation.invoiceId);
  return result ?? ({ error: "not_found", status: 404 } as const);
}

async function execute(
  operation: PocketRequest,
  device: { id: string; userId: string; workspaceId: string; name: string },
) {
  if (operation.op === "me") return { device };
  if (operation.op === "device.register_push") {
    await registerPocketPushToken({
      deviceId: device.id,
      apnsToken: operation.token.toLowerCase(),
      environment: operation.environment,
    });
    return { registered: true };
  }
  return executeAuthorized(operation, device);
}

export async function POST(request: Request) {
  const gate = await requirePocketDevice(request);
  if ("response" in gate) return gate.response;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = PocketRequestSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_request" }, 400);
  const result = await execute(parsed.data, gate.device);
  if ("error" in result && "status" in result) {
    return json({ error: result.error }, result.status);
  }
  return json(result);
}
