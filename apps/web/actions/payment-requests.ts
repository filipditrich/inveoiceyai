"use server";

import { requireWritableWorkspace } from "@/lib/auth/session";
import { assertCan } from "@/lib/authz/can";
import { createStandalonePaymentRequest } from "@/lib/payments/create-payment-request";
import { resolveCollectingAccount } from "@/lib/payments/payment-request-account";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { decimalToMinor } from "@invoicey/payment-core";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createPaymentRequestAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId, userId } = await requireWritableWorkspace();
  await assertCan("payments:manage");

  const amount = field(formData, "amount").replace(",", ".");
  const message = field(formData, "message");
  try {
    if (decimalToMinor(amount) <= BigInt(0)) {
      throw new Error("invalid_amount");
    }
  } catch {
    redirect("/payments/requests/new?error=invalid_amount");
  }

  const account = await resolveCollectingAccount(workspaceId);
  if (!account) {
    redirect("/settings/workspace/bank-connections?error=no_bank_connection");
  }

  const request = await createStandalonePaymentRequest({
    workspaceId,
    issuerId: account.issuerId,
    bankAccountId: account.bankAccountId,
    iban: account.iban,
    amount,
    message,
    createdByUserId: userId,
  });

  revalidatePath("/payments");
  revalidatePath("/dashboard");
  redirect(`/payments/requests/${request.id}`);
}
