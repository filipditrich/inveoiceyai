"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { useState } from "react";

type Provider = "google" | "github";

export function SignInForm({
  next,
  providers,
}: {
  next: string;
  providers: Provider[];
}) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInWith(provider: Provider) {
    setPending(provider);
    setError(null);
    const { error: signInError } = await authClient.signIn.social({
      provider,
      callbackURL: next,
    });
    if (signInError) {
      // Only reached when the redirect never happens.
      setError(signInError.message ?? "Sign-in failed. Please try again.");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {providers.includes("google") && (
        <Button
          variant="outline"
          className="w-full"
          disabled={pending !== null}
          onClick={() => signInWith("google")}
        >
          {pending === "google" ? "Redirecting…" : "Continue with Google"}
        </Button>
      )}
      {providers.includes("github") && (
        <Button
          variant="outline"
          className="w-full"
          disabled={pending !== null}
          onClick={() => signInWith("github")}
        >
          {pending === "github" ? "Redirecting…" : "Continue with GitHub"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
