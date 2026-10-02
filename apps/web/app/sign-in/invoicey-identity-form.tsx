"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { safeNext } from "@/lib/auth/safe-next";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export function InvoiceyIdentityForm({
  next,
  disabled,
}: {
  next: string;
  disabled: boolean;
}) {
  const t = useTranslations("Auth.identity");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const credentials = credentialsSchema.safeParse({
      email: data.get("email"),
      password: data.get("password"),
    });
    if (!credentials.success) {
      setFailed(true);
      return;
    }
    setPending(true);
    setFailed(false);
    try {
      const result = await authClient.signIn.email({
        email: credentials.data.email,
        password: credentials.data.password,
      });
      if (result.error) {
        setFailed(true);
        return;
      }
      window.location.assign(safeNext(next));
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full"
        disabled={disabled || pending}
        aria-expanded={open}
        aria-controls="invoicey-identity"
        onClick={() => setOpen(!open)}
      >
        {t("continue")}
      </Button>
      {open && (
        <form
          id="invoicey-identity"
          onSubmit={submit}
          className="mt-4 space-y-4"
        >
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("hint")}
          </p>
          <label className="block space-y-2 text-sm">
            <span>{t("email")}</span>
            <Input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              disabled={pending || disabled}
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>{t("password")}</span>
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              disabled={pending || disabled}
            />
          </label>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t("error")}
            </p>
          )}
          <Button
            type="submit"
            className="min-h-11 w-full"
            disabled={pending || disabled}
          >
            {pending ? t("pending") : t("submit")}
          </Button>
          <Link
            href="/support"
            className="inline-flex min-h-11 items-center text-xs underline"
          >
            {t("support")}
          </Link>
        </form>
      )}
    </div>
  );
}
