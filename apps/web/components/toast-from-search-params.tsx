"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMessages, useTranslations } from "next-intl";
import { Suspense, useEffect } from "react";
import { toast } from "sonner";

import { messageLookup } from "@/lib/i18n-lookup";

const TOAST_KEYS = [
  "issuer_saved",
  "issuer_deleted",
  "client_saved",
  "client_deleted",
  "invoice_saved",
  "invoice_issued",
  "invoice_paid",
  "invoice_unpaid",
  "invoice_cancelled",
  "invoice_deleted",
  "invoice_duplicated",
  "invoice_emailed",
  "recurring_saved",
  "recurring_paused",
  "recurring_resumed",
  "recurring_skipped",
  "recurring_drafted",
  "recurring_deleted",
  "payment_confirmed",
  "payment_rejected",
  "payment_added",
  "payment_reversed",
  "bank_connected",
  "bank_disconnected",
  "bank_synced",
  "bank_auto_match_enabled",
  "bank_auto_match_disabled",
  "platform_admin_granted",
  "platform_admin_revoked",
  "platform_admin_last",
  "platform_admin_failed",
] as const;

type ToastKey = (typeof TOAST_KEYS)[number];

function isToastKey(value: string | null): value is ToastKey {
  return value !== null && (TOAST_KEYS as readonly string[]).includes(value);
}

function ToastFromSearchParamsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("Toasts");
  const descriptions = useTranslations("ToastDescriptions");
  const bankCopy = useTranslations("Settings.bankConnections");
  const messages = useMessages();
  const toastKey = searchParams.get("toast");
  const error = searchParams.get("error");
  const mergeGroups = searchParams.get("groups");
  const mergeRemoved = searchParams.get("removed");
  const mergeRepointed = searchParams.get("repointed");
  const ok = searchParams.get("ok");
  const skipped = searchParams.get("skipped");
  const failed = searchParams.get("failed");
  const imported = searchParams.get("imported");
  const proposed = searchParams.get("proposed");
  const autoMatched = searchParams.get("autoMatched");

  useEffect(() => {
    if (!toastKey && !error) {
      return;
    }
    if (error && error !== "NEXT_REDIRECT") {
      toast.error(t("action_failed"), {
        description: messageLookup(
          messages.Settings.bankConnections.errors,
          error,
          bankCopy("errors.generic", { code: error.replaceAll("_", " ") }),
        ),
        duration: 6500,
      });
    } else if (toastKey === "clients_merged") {
      toast.success(
        t("clients_merged", {
          groups: mergeGroups ?? "0",
          removed: mergeRemoved ?? "0",
          repointed: mergeRepointed ?? "0",
        }),
      );
    } else if (toastKey === "bulk_summary") {
      toast.success(
        t("bulk_summary", {
          ok: String(Number(ok) || 0),
          skipped: String(Number(skipped) || 0),
          failed: String(Number(failed) || 0),
        }),
      );
    } else if (
      toastKey === "platform_admin_last" ||
      toastKey === "platform_admin_failed"
    ) {
      toast.error(t(toastKey), { description: descriptions(toastKey) });
    } else if (isToastKey(toastKey)) {
      const detail =
        toastKey === "bank_synced"
          ? descriptions("bank_synced", {
              imported: String(Number(imported) || 0),
              proposed: String(Number(proposed) || 0),
              autoMatched: String(Number(autoMatched) || 0),
            })
          : descriptions(toastKey);
      const warningKeys: ToastKey[] = [
        "invoice_unpaid",
        "payment_rejected",
        "payment_reversed",
        "bank_disconnected",
        "bank_auto_match_disabled",
      ];
      const notify = warningKeys.includes(toastKey)
        ? toast.warning
        : toast.success;
      notify(t(toastKey), { description: detail, duration: 5000 });
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    url.searchParams.delete("error");
    url.searchParams.delete("groups");
    url.searchParams.delete("removed");
    url.searchParams.delete("repointed");
    url.searchParams.delete("ok");
    url.searchParams.delete("skipped");
    url.searchParams.delete("failed");
    url.searchParams.delete("imported");
    url.searchParams.delete("proposed");
    url.searchParams.delete("autoMatched");
    router.replace(`${url.pathname}${url.search}${url.hash}`, {
      scroll: false,
    });
  }, [
    toastKey,
    error,
    mergeGroups,
    mergeRemoved,
    mergeRepointed,
    ok,
    skipped,
    failed,
    imported,
    proposed,
    autoMatched,
    router,
    t,
    descriptions,
    bankCopy,
    messages,
  ]);

  return null;
}

/** Shows a one-shot toast from `?toast=` then strips the query param. */
export function ToastFromSearchParams() {
  return (
    <Suspense fallback={null}>
      <ToastFromSearchParamsInner />
    </Suspense>
  );
}
