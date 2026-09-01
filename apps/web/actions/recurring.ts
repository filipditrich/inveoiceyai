"use server";

import { requireWorkspace } from "@/lib/auth/session";
import { assertCan } from "@/lib/authz/can";
import { pragueTodayIso } from "@/lib/invoice-status-sql";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createRecurringFromInvoice,
  deleteRecurringTemplate,
  pauseRecurringSchedule,
  runScheduleNow,
  skipNextRecurring,
  RecurringCadenceSchema,
  type RecurringCadence,
} from "@invoicey/invoice-tools/ops";

function optionalTrim(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const s = value.trim();
  return s.length > 0 ? s : undefined;
}

function fail(path: string, code: string): never {
  redirect(`${path}?invalid=${encodeURIComponent(code)}`);
}

function parseCadence(raw: string | undefined): RecurringCadence | null {
  const parsed = RecurringCadenceSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function saveRecurringFromInvoice(
  formData: FormData,
): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  await assertCan("recurring:manage");
  const invoiceId = optionalTrim(formData.get("invoiceId"));
  const name = optionalTrim(formData.get("name"));
  const cadence = parseCadence(optionalTrim(formData.get("cadence")));
  const dayRaw = optionalTrim(formData.get("dayOfMonth"));
  const nextRunOn = optionalTrim(formData.get("nextRunOn"));
  const back = invoiceId ? `/invoices/${invoiceId}` : "/invoices/recurring";
  if (!invoiceId) {
    fail("/invoices/recurring", "missing_id");
  }
  if (!name || !cadence || !dayRaw) {
    fail(back, "missing_name");
  }
  const dayOfMonth = Number(dayRaw);
  const result = await createRecurringFromInvoice({
    workspaceId,
    invoiceId,
    name,
    cadence,
    dayOfMonth,
    nextRunOn,
    todayIso: pragueTodayIso(),
  });
  if (!result.ok) {
    fail(back, result.error);
  }
  revalidatePath("/invoices/recurring");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect("/invoices/recurring?toast=recurring_saved");
}

export async function setRecurringPaused(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  await assertCan("recurring:manage");
  const scheduleId = optionalTrim(formData.get("scheduleId"));
  const paused = optionalTrim(formData.get("paused")) === "1";
  if (!scheduleId) {
    fail("/invoices/recurring", "missing_id");
  }
  const result = await pauseRecurringSchedule({
    workspaceId,
    scheduleId,
    paused,
  });
  if (!result.ok) {
    fail("/invoices/recurring", result.error);
  }
  revalidatePath("/invoices/recurring");
  redirect(
    paused
      ? "/invoices/recurring?toast=recurring_paused"
      : "/invoices/recurring?toast=recurring_resumed",
  );
}

export async function skipRecurringNext(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  await assertCan("recurring:manage");
  const scheduleId = optionalTrim(formData.get("scheduleId"));
  if (!scheduleId) {
    fail("/invoices/recurring", "missing_id");
  }
  const result = await skipNextRecurring({
    workspaceId,
    scheduleId,
    todayIso: pragueTodayIso(),
  });
  if (!result.ok) {
    fail("/invoices/recurring", result.error);
  }
  revalidatePath("/invoices/recurring");
  redirect("/invoices/recurring?toast=recurring_skipped");
}

export async function runRecurringNow(formData: FormData): Promise<void> {
  await assertCan("recurring:manage");
  const { workspaceId } = await requireWorkspace();
  const scheduleId = optionalTrim(formData.get("scheduleId"));
  if (!scheduleId) {
    fail("/invoices/recurring", "missing_id");
  }
  const result = await runScheduleNow({
    workspaceId,
    scheduleId,
    todayIso: pragueTodayIso(),
  });
  if (!result.ok) {
    fail("/invoices/recurring", result.error);
  }
  revalidatePath("/invoices");
  revalidatePath("/invoices/recurring");
  revalidatePath("/dashboard");
  redirect(`/invoices/${result.invoiceId}/edit?toast=recurring_drafted`);
}

export async function deleteRecurring(formData: FormData): Promise<void> {
  await assertCan("recurring:manage");
  const { workspaceId } = await requireWorkspace();
  const templateId = optionalTrim(formData.get("templateId"));
  if (!templateId) {
    fail("/invoices/recurring", "missing_id");
  }
  const result = await deleteRecurringTemplate({ workspaceId, templateId });
  if (!result.ok) {
    fail("/invoices/recurring", result.error);
  }
  revalidatePath("/invoices/recurring");
  redirect("/invoices/recurring?toast=recurring_deleted");
}
