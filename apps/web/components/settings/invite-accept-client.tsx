"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { recordAccountSecurityEventAction } from "@/actions/security";
import { acceptWorkspaceInviteAction } from "@/actions/workspace";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export function InviteAcceptClient({
  invitationId,
  canAct,
}: {
  invitationId: string;
  canAct: boolean;
}) {
  const t = useTranslations("Invite");
  const tErrors = useTranslations("App.workspaceErrors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  const accept = () => {
    if (!canAct) return;
    setBusy("accept");
    startTransition(async () => {
      try {
        const result = await acceptWorkspaceInviteAction(invitationId);
        if (result && !result.ok) {
          toast.error(tErrors(result.errorCode));
          return;
        }
        /** success redirects to /dashboard from the server action */
        setDone("accepted");
      } finally {
        setBusy(null);
      }
    });
  };

  const decline = () => {
    if (!canAct) return;
    setBusy("decline");
    startTransition(async () => {
      try {
        const res = await authClient.organization.rejectInvitation({
          invitationId,
        });
        if (res.error) {
          toast.error(res.error.message || t("declineFailed"));
          return;
        }
        await recordAccountSecurityEventAction({
          type: "invite_reject",
          metadata: { invitationId },
        });
        setDone("declined");
        toast.success(t("declineSuccess"));
        router.push("/dashboard");
        router.refresh();
      } finally {
        setBusy(null);
      }
    });
  };

  if (!canAct) return null;

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        className="w-full"
        disabled={done !== null || pending}
        loading={busy === "accept"}
        onClick={accept}
      >
        {done === "accepted"
          ? t("accepted")
          : busy === "accept"
            ? t("accepting")
            : t("accept")}
      </Button>
      <Button
        className="w-full"
        variant="outline"
        disabled={done !== null || pending}
        loading={busy === "decline"}
        onClick={decline}
      >
        {done === "declined"
          ? t("declined")
          : busy === "decline"
            ? t("declining")
            : t("decline")}
      </Button>
    </div>
  );
}
