"use client";

import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { useAssistant } from "./assistant-provider";

/** Opens the assistant panel, then sends the browser on to the invoices list. */
export function AssistantHandoff() {
  const t = useTranslations("Assistant");
  const { setOpen } = useAssistant();
  const router = useRouter();

  useEffect(() => {
    setOpen(true);
    router.replace("/invoices");
  }, [router, setOpen]);

  return (
    <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
      <Spinner />
      {t("openingPanel")}
    </div>
  );
}
