"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { toast } from "sonner";

const TOAST_MESSAGES: Record<
  string,
  { type: "success" | "error"; text: string }
> = {
  issuer_saved: { type: "success", text: "Vystavovatel uložen" },
  issuer_deleted: { type: "success", text: "Vystavovatel smazán" },
  client_saved: { type: "success", text: "Client saved" },
  client_deleted: { type: "success", text: "Client deleted" },
  clients_merged: { type: "success", text: "Duplicitní klienti sloučeni" },
  invoice_saved: { type: "success", text: "Draft saved" },
  invoice_issued: { type: "success", text: "Invoice issued" },
  invoice_paid: { type: "success", text: "Marked as paid" },
  invoice_cancelled: { type: "success", text: "Invoice cancelled" },
  invoice_deleted: { type: "success", text: "Draft deleted" },
  invoice_duplicated: { type: "success", text: "Invoice duplicated" },
  invoice_emailed: { type: "success", text: "Faktura odeslána e-mailem" },
};

function ToastFromSearchParamsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toastKey = searchParams.get("toast");
  const mergeGroups = searchParams.get("groups");
  const mergeRemoved = searchParams.get("removed");
  const mergeRepointed = searchParams.get("repointed");

  useEffect(() => {
    if (!toastKey) {
      return;
    }
    if (toastKey === "clients_merged") {
      toast.success(
        `Sloučeno ${mergeGroups ?? "0"} skupin — odstraněno ${mergeRemoved ?? "0"} klientů, přesměrováno ${mergeRepointed ?? "0"} faktur`,
      );
    } else {
      const msg = TOAST_MESSAGES[toastKey];
      if (msg) {
        if (msg.type === "success") {
          toast.success(msg.text);
        } else {
          toast.error(msg.text);
        }
      }
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    url.searchParams.delete("groups");
    url.searchParams.delete("removed");
    url.searchParams.delete("repointed");
    router.replace(`${url.pathname}${url.search}${url.hash}`, {
      scroll: false,
    });
  }, [toastKey, mergeGroups, mergeRemoved, mergeRepointed, router]);

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
