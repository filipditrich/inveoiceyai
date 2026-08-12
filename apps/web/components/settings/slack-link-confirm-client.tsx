"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { confirmSlackLinkAction } from "@/actions/slack-link";
import { Button } from "@/components/ui/button";

export function SlackLinkConfirmClient({
  code,
  canAct,
}: {
  code: string;
  canAct: boolean;
}) {
  const t = useTranslations("SlackLink");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const confirm = () => {
    if (!canAct) return;
    startTransition(async () => {
      const result = await confirmSlackLinkAction(code);
      if (!result.ok) {
        switch (result.error) {
          case "steal_refused":
            toast.error(t("stealRefused"));
            break;
          case "expired":
            toast.error(t("expired"));
            break;
          case "not_found":
            toast.error(t("notFound"));
            break;
          default: {
            const _exhaustive: never = result.error;
            toast.error(_exhaustive);
          }
        }
        return;
      }
      setDone(true);
      toast.success(
        result.decision === "rebind" ? t("rebindSuccess") : t("confirmSuccess"),
      );
      router.push("/settings/integrations");
      router.refresh();
    });
  };

  if (!canAct) return null;

  return (
    <Button
      className="w-full"
      disabled={done || pending}
      loading={pending}
      onClick={confirm}
    >
      {done ? t("confirmed") : pending ? t("confirming") : t("confirm")}
    </Button>
  );
}
