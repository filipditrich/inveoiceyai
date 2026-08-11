"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export function InviteAcceptClient({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const accept = () => {
    startTransition(async () => {
      const res = await authClient.organization.acceptInvitation({
        invitationId,
      });
      if (res.error) {
        toast.error(res.error.message || "Přijetí pozvánky selhalo");
        return;
      }
      setDone(true);
      toast.success("Pozvánka přijata");
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <Button
      className="w-full"
      disabled={done}
      loading={pending}
      onClick={accept}
    >
      {done ? "Přijato" : pending ? "Přijímám…" : "Přijmout pozvánku"}
    </Button>
  );
}
