"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function CopyInboxAddress({ address }: { address: string }) {
  const t = useTranslations("Settings.incomingInvoices");
  const tCommon = useTranslations("Common");

  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(address);
        toast.success(t("copied"));
      }}
    >
      {tCommon("copy")}
    </Button>
  );
}
