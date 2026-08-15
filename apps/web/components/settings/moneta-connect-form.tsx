"use client";

import { ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";

import {
  connectMoneta,
  discoverMonetaAccountsAction,
} from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [token, setToken] = useState("");
  const [issuerId, setIssuerId] = useState(issuers[0]?.id ?? "");
  const [accounts, setAccounts] = useState<MonetaAccountOption[] | null>(null);
  const [providerAccountId, setProviderAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!encryptionReady) {
    return (
      <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm">
        Bank token encryption is not configured. Set
        {" BANK_TOKEN_ENCRYPTION_KEY_V1 "}
        before connecting an account.
      </p>
    );
  }

  if (issuers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Create your issuer business before connecting its receiving account.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="moneta-issuerId">Issuer receiving payments</Label>
        <select
          id="moneta-issuerId"
          name="issuerId"
          required
          className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm"
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
        <Label htmlFor="moneta-token">MONETA API token</Label>
        <Input
          id="moneta-token"
          name="token"
          type="password"
          required
          minLength={16}
          autoComplete="off"
          spellCheck={false}
          placeholder="Read-only API token from Internet Banka"
          value={token}
          onChange={(event) => {
            setToken(event.target.value);
            setAccounts(null);
            setProviderAccountId("");
            setError(null);
          }}
          disabled={!canManage || pending}
        />
        <p className="text-muted-foreground text-xs">
          Create a passive (read-only) token in Internet Banka → API tokeny.
          Tokens expire after up to 90 days unless renewed. History is limited
          to 90 days.
        </p>
        <a
          className="text-brand inline-flex items-center gap-1 text-xs font-medium hover:underline"
          href="https://www.moneta.cz/zivnostnici-a-firmy/api"
          rel="noreferrer"
          target="_blank"
        >
          How to create a MONETA API token
          <ExternalLinkIcon className="size-3" />
        </a>
      </div>

      {accounts && accounts.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor="moneta-account">CZK account</Label>
          <select
            id="moneta-account"
            className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm"
            value={providerAccountId}
            onChange={(event) => setProviderAccountId(event.target.value)}
            disabled={!canManage || pending}
            required
          >
            <option value="">Select account</option>
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
        <p className="text-destructive text-sm">{error.replaceAll("_", " ")}</p>
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
          Discover accounts
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
            Connect and verify
          </Button>
        </form>
      </div>
      {!canManage ? (
        <p className="text-muted-foreground text-xs">
          A workspace admin or owner must connect bank accounts.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Prefer Discover accounts when the token covers more than one CZK
          account. A single CZK account connects without selection.
        </p>
      )}
    </div>
  );
}
