"use client";

import { useState, useTransition } from "react";
import {
  connectMoneta,
  discoverMonetaAccountsAction,
} from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messageLookup } from "@/lib/i18n-lookup";
import { ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { useMessages, useTranslations } from "next-intl";

type IssuerOption = {
  id: string;
  label: string;
};

type MonetaAccountOption = {
  providerAccountId: string;
  accountNumber: string;
  iban: string;
  currency: string;
  name?: string | null;
};

type MonetaConnectFormProps = {
  issuers: IssuerOption[];
  canManage: boolean;
  encryptionReady: boolean;
};

export function MonetaConnectForm({
  issuers,
  canManage,
  encryptionReady,
}: MonetaConnectFormProps) {
  const t = useTranslations("Settings.bankConnections");
  const messages = useMessages();
  const [token, setToken] = useState("");
  const [issuerId, setIssuerId] = useState(issuers[0]?.id ?? "");
  const [accounts, setAccounts] = useState<MonetaAccountOption[] | null>(null);
  const [providerAccountId, setProviderAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!encryptionReady) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {t("encryptionMissing")}
      </p>
    );
  }

  if (issuers.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("needIssuer")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="moneta-issuerId">{t("issuerLabel")}</Label>
        <select
          id="moneta-issuerId"
          name="issuerId"
          required
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
          value={issuerId}
          onChange={(event) => setIssuerId(event.target.value)}
          disabled={!canManage || pending}
        >
          {issuers.map((issuer) => (
            <option key={issuer.id} value={issuer.id}>
              {issuer.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="moneta-token">{t("moneta.tokenLabel")}</Label>
        <Input
          id="moneta-token"
          name="token"
          type="password"
          required
          minLength={16}
          autoComplete="off"
          spellCheck={false}
          placeholder={t("moneta.tokenPlaceholder")}
          value={token}
          onChange={(event) => {
            setToken(event.target.value);
            setAccounts(null);
            setProviderAccountId("");
            setError(null);
          }}
          disabled={!canManage || pending}
        />
        <p className="text-xs text-muted-foreground">{t("moneta.tokenHelp")}</p>
        <a
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
          href="https://www.moneta.cz/zivnostnici-a-firmy/api"
          rel="noreferrer"
          target="_blank"
        >
          {t("moneta.tokenGuide")}
          <ExternalLinkIcon className="size-3" />
        </a>
      </div>

      {accounts && accounts.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor="moneta-account">{t("moneta.accountLabel")}</Label>
          <select
            id="moneta-account"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={providerAccountId}
            onChange={(event) => setProviderAccountId(event.target.value)}
            disabled={!canManage || pending}
            required
          >
            <option value="">{t("moneta.selectAccount")}</option>
            {accounts.map((account) => (
              <option
                key={account.providerAccountId}
                value={account.providerAccountId}
              >
                {(account.name ? `${account.name} · ` : "") +
                  `${account.accountNumber} · ${account.iban}`}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">
          {messageLookup(
            messages.Settings.bankConnections.errors,
            error,
            t("errors.generic", { code: error.replaceAll("_", " ") }),
          )}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!canManage || pending || token.trim().length < 16}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await discoverMonetaAccountsAction({ token });
              if (!result.ok) {
                setError(result.error);
                setAccounts(null);
                return;
              }
              setAccounts(result.accounts);
              if (result.accounts.length === 1) {
                setProviderAccountId(
                  result.accounts[0]?.providerAccountId ?? "",
                );
              } else {
                setProviderAccountId("");
              }
            });
          }}
        >
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          {t("moneta.discover")}
        </Button>
        <form action={connectMoneta}>
          <input type="hidden" name="issuerId" value={issuerId} />
          <input type="hidden" name="token" value={token} />
          <input
            type="hidden"
            name="providerAccountId"
            value={providerAccountId}
          />
          <Button
            type="submit"
            disabled={
              !canManage ||
              pending ||
              token.trim().length < 16 ||
              (accounts !== null && accounts.length > 1 && !providerAccountId)
            }
          >
            {t("connectAndVerify")}
          </Button>
        </form>
      </div>
      {!canManage ? (
        <p className="text-xs text-muted-foreground">{t("adminOnly")}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("moneta.discoverHint")}
        </p>
      )}
    </div>
  );
}
