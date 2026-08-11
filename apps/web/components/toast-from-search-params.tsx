"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect } from "react";
import { toast } from "sonner";

const TOAST_KEYS = [
  "issuer_saved",
  "issuer_deleted",
  "client_saved",
  "client_deleted",
  "invoice_saved",
  "invoice_issued",
  "invoice_paid",
  "invoice_cancelled",
  "invoice_deleted",
  "invoice_duplicated",
  "invoice_emailed",
  "platform_admin_granted",
  "platform_admin_revoked",
  "platform_admin_last",
  "platform_admin_failed",
] as const;

type ToastKey = (typeof TOAST_KEYS)[number];

function isToastKey(value: string): value is ToastKey {
  return (TOAST_KEYS as readonly string[]).includes(value);
}

function ToastFromSearchParamsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("Toasts");
  const toastKey = searchParams.get("toast");
  const mergeGroups = searchParams.get("groups");
  const mergeRemoved = searchParams.get("removed");
  const mergeRepointed = searchParams.get("repointed");
  const ok = searchParams.get("ok");
  const skipped = searchParams.get("skipped");
  const failed = searchParams.get("failed");

  useEffect(() => {
    if (!toastKey) {
      return;
    }
    if (toastKey === "clients_merged") {
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
      toast.error(t(toastKey));
    } else if (isToastKey(toastKey)) {
      toast.success(t(toastKey));
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    url.searchParams.delete("groups");
    url.searchParams.delete("removed");
    url.searchParams.delete("repointed");
    url.searchParams.delete("ok");
    url.searchParams.delete("skipped");
    url.searchParams.delete("failed");
    router.replace(`${url.pathname}${url.search}${url.hash}`, {
      scroll: false,
    });
  }, [
    toastKey,
    mergeGroups,
    mergeRemoved,
    mergeRepointed,
    ok,
    skipped,
    failed,
    router,
    t,
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
