import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOptionalWorkspace, requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

import { createFirstWorkspace } from "./actions";

export const metadata = { title: "Set up your workspace — Invoicey" };

/**
 * Reached only when a signed-in user has no workspace at all. Normally
 * impossible — one is created on first sign-in — but a partially failed
 * bootstrap must not leave the account with nowhere to go.
 */
export default async function OnboardingPage() {
  const user = await requireSession();
  if (await getOptionalWorkspace()) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set up your workspace</CardTitle>
          <CardDescription>
            Signed in as {user.email}, but you are not a member of any workspace
            yet. Create one to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createFirstWorkspace}>
            <Button type="submit" className="w-full">
              Create my workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
