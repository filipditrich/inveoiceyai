"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type Provider = "google" | "github";

export function SignInForm({
  next,
  providers,
}: {
  next: string;
  providers: Provider[];
}) {
  const t = useTranslations("Auth");
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
      setError(signInError.message ?? t("failed"));
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {providers.includes("google") && (
        <Button
          variant="outline"
          className="h-11 w-full justify-start px-4 text-sm"
          disabled={pending !== null}
          onClick={() => signInWith("google")}
        >
          {pending === "google" ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          <span className="flex-1 text-center">
            {pending === "google" ? t("redirecting") : t("continueGoogle")}
          </span>
        </Button>
      )}
      {providers.includes("github") && (
        <Button
          variant="outline"
          className="h-11 w-full justify-start px-4 text-sm"
          disabled={pending !== null}
          onClick={() => signInWith("github")}
        >
          {pending === "github" ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : (
            <GitHubIcon />
          )}
          <span className="flex-1 text-center">
            {pending === "github" ? t("redirecting") : t("continueGitHub")}
          </span>
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t("failed")} ({error})
        </p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.74 2.98-4.31 2.98-7.39Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.38l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.12-1.32.31-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.53l3.35-2.61Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.78.5 3.82 1.5l2.88-2.87A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-1.04-.02-1.89-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.66.35-1.12.64-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.35 9.35 0 0 1 12 6.97c.85 0 1.69.12 2.49.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.95.68 1.92 0 1.38-.01 2.5-.01 2.85 0 .27.18.59.69.49A10.22 10.22 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}
