import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { InviteAcceptClient } from "@/components/settings/invite-accept-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth/auth";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent(`/invite/${id}`)}`);
  }

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Pozvánka do workspace</CardTitle>
          <CardDescription>
            Přijměte pozvánku pro přístup k fakturám tohoto workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InviteAcceptClient invitationId={id} />
          <Button variant="ghost" render={<Link href="/" />}>
            Zpět do aplikace
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
