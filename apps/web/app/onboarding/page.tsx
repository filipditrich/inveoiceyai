import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { getOptionalWorkspace, requireSession } from "@/lib/auth/session";
import { Building2Icon, CheckCircle2Icon } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createFirstWorkspace } from "./actions";

export const metadata: Metadata = {
  title: "Nastavení pracovního prostoru",
  robots: { index: false, follow: false },
};

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
    <AuthShell>
      <div>
        <span className="bg-brand/15 grid size-12 place-items-center rounded-2xl">
          <Building2Icon className="size-5" />
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.035em]">
          Dokončete pracovní prostor
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Účet{" "}
          <strong className="text-foreground font-medium">{user.email}</strong>{" "}
          je přihlášený, ale nemá pracovní prostor. Obvykle jej vytvoříme
          automaticky; tímto krokem dokončíte přerušené nastavení.
        </p>
        <div className="bg-muted/30 mt-6 space-y-2 rounded-2xl border p-4 text-sm">
          {[
            "Soukromý prostor pro vaše faktury",
            "Role vlastníka pracovního prostoru",
            "Možnost přidat první dodavatelskou firmu",
          ].map((item) => (
            <p key={item} className="flex items-center gap-2">
              <CheckCircle2Icon className="text-primary size-4" />
              {item}
            </p>
          ))}
        </div>
        <form action={createFirstWorkspace} className="mt-7">
          <Button type="submit" className="h-11 w-full">
            Vytvořit můj pracovní prostor
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
