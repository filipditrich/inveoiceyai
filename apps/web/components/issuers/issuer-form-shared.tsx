"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_TEMPLATES,
  DOC_TYPES,
  type NumberingSchemeDraft,
} from "@/lib/issuer-types";
import { UploadDropzone } from "@/lib/uploadthing";
import type { ClientDraft } from "@invoicey/ares";
import {
  IcoSchema,
  isValidCzIban,
  suggestCzIban,
} from "@invoicey/invoice-core/schema";
import * as React from "react";

export { DEFAULT_TEMPLATES, DOC_TYPES, type NumberingSchemeDraft };

export function FieldGroup(props: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      {props.children}
    </div>
  );
}

/** Suggest CZ IBAN from account number; preserve manual IBAN edits. */
export function useCzechIbanSuggest(initialAccount = "", initialIban = "") {
  const [accountNumber, setAccountNumber] = React.useState(initialAccount);
  const [iban, setIban] = React.useState(initialIban);
  const [ibanTouched, setIbanTouched] = React.useState(false);
  const [autoIban, setAutoIban] = React.useState<string | null>(() =>
    suggestCzIban(initialAccount),
  );

  function onAccountNumberChange(value: string) {
    setAccountNumber(value);
    const suggested = suggestCzIban(value);
    setAutoIban(suggested);
    if (
      !ibanTouched ||
      iban === "" ||
      (autoIban != null && iban === autoIban)
    ) {
      setIban(suggested ?? "");
      if (suggested) {
        setIbanTouched(false);
      }
    }
  }

  function onIbanChange(value: string) {
    setIbanTouched(true);
    setIban(value.replace(/\s+/gu, "").toUpperCase());
  }

  function seedBank(nextAccount: string, nextIban?: string) {
    setAccountNumber(nextAccount);
    const suggested = suggestCzIban(nextAccount);
    setAutoIban(suggested);
    const resolved =
      (nextIban?.replace(/\s+/gu, "").toUpperCase() || suggested) ?? "";
    setIban(resolved);
    setIbanTouched(Boolean(nextIban && nextIban !== suggested));
  }

  const accountHint =
    accountNumber.trim() && !suggestCzIban(accountNumber)
      ? "Zadejte účet ve tvaru 123456789/0100 nebo 19-2000145399/0800."
      : null;
  const ibanHint =
    iban.trim() && !isValidCzIban(iban)
      ? "IBAN má neplatný kontrolní součet."
      : autoIban && iban === autoIban
        ? "IBAN doplněn z čísla účtu."
        : null;

  return {
    accountNumber,
    iban,
    setAccountNumber: onAccountNumberChange,
    setIban: onIbanChange,
    seedBank,
    accountHint,
    ibanHint,
  };
}

export function BankAccountFields(props: {
  accountNumber: string;
  iban: string;
  bic: string;
  onAccountNumber: (v: string) => void;
  onIban: (v: string) => void;
  onBic: (v: string) => void;
  accountHint?: string | null;
  ibanHint?: string | null;
  required?: boolean;
}) {
  return (
    <>
      <FieldGroup label="Číslo účtu (např. 123456789/0100)">
        <Input
          onChange={(ev) => {
            props.onAccountNumber(ev.target.value);
          }}
          required={props.required}
          value={props.accountNumber}
        />
        {props.accountHint ? (
          <p className="text-muted-foreground text-xs">{props.accountHint}</p>
        ) : null}
      </FieldGroup>
      <FieldGroup label="IBAN">
        <Input
          onChange={(ev) => {
            props.onIban(ev.target.value);
          }}
          required={props.required}
          value={props.iban}
        />
        {props.ibanHint ? (
          <p className="text-muted-foreground text-xs">{props.ibanHint}</p>
        ) : null}
      </FieldGroup>
      <FieldGroup label="BIC (volitelné)">
        <Input
          onChange={(ev) => {
            props.onBic(ev.target.value);
          }}
          value={props.bic}
        />
      </FieldGroup>
    </>
  );
}

export function AssetField(props: {
  label: string;
  url: string;
  onUrl: (v: string) => void;
  endpoint: "issuerLogo" | "issuerStamp" | "issuerSignature";
  uploadConfigured: boolean;
}) {
  const [showUrl, setShowUrl] = React.useState(false);
  const hasUrl = props.url.trim().length > 0;

  return (
    <div className="space-y-3">
      <Label>{props.label}</Label>
      {hasUrl ? (
        <div className="bg-muted/40 flex items-start gap-3 rounded-lg border p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={props.label}
            className="bg-background h-16 w-16 rounded object-contain"
            src={props.url}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-muted-foreground truncate text-xs">
              {props.url}
            </p>
            <Button
              onClick={() => {
                props.onUrl("");
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Odebrat
            </Button>
          </div>
        </div>
      ) : null}
      {props.uploadConfigured ? (
        <UploadDropzone
          endpoint={props.endpoint}
          onClientUploadComplete={(res) => {
            const first = res[0];
            const url =
              (first?.serverData as { url?: string } | undefined)?.url ??
              first?.ufsUrl ??
              first?.url;
            if (typeof url === "string" && url.length > 0) {
              props.onUrl(url);
            }
          }}
          onUploadError={(err) => {
            console.error(err);
          }}
        />
      ) : (
        <p className="text-muted-foreground text-xs">
          Upload není k dispozici — vložte URL níže.
        </p>
      )}
      <div className="space-y-2">
        <button
          className="text-muted-foreground text-xs underline-offset-2 hover:underline"
          onClick={() => {
            setShowUrl((v) => !v);
          }}
          type="button"
        >
          {showUrl ? "Skrýt URL" : "Vložit URL ručně"}
        </button>
        {showUrl || !props.uploadConfigured ? (
          <Input
            onChange={(ev) => {
              props.onUrl(ev.target.value);
            }}
            placeholder="https://…"
            type="url"
            value={props.url}
          />
        ) : null}
      </div>
    </div>
  );
}

export function lookupMessageFromInvalid(
  inv: string | null | undefined,
): string | null {
  if (!inv) {
    return null;
  }
  const map: Record<string, string> = {
    required_fields: "Vyplňte povinná pole.",
    bad_ico: "Neplatné IČO.",
    bad_dic: "Neplatné DIČ.",
    bad_bank: "Neplatný účet / IBAN.",
    snapshot_validation: "Údaje neodpovídají schématu vystavovatele.",
    missing_row: "Záznam nenalezen.",
    has_invoices: "Nelze smazat — existují faktury tohoto vystavovatele.",
    save_failed: "Uložení se nezdařilo.",
  };
  return map[inv] ?? `Chyba: ${inv}`;
}

export function aresErrorHuman(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "ARES nevrátila data.";
  }
  const maybe = payload as { message?: unknown };
  if (typeof maybe.message === "string") {
    return maybe.message;
  }
  return "Vyhledání v ARES se nezdařilo.";
}

export type AresFillResult = {
  draft: ClientDraft;
};

/** Shared ARES IČO lookup used by identity / create / welcome forms. */
export async function lookupAresByIco(
  icoInput: string,
): Promise<{ ok: true; draft: ClientDraft } | { ok: false; message: string }> {
  const raw = (icoInput ?? "").replace(/\s/g, "");
  const parsed = IcoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Zadejte platné osmimístné IČO." };
  }
  const res = await fetch(`/api/ares/${parsed.data}`);
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return { ok: false, message: "ARES nevrátila JSON." };
  }
  if (
    payload &&
    typeof payload === "object" &&
    "ok" in payload &&
    payload.ok === true &&
    "draft" in payload
  ) {
    return { ok: true, draft: (payload as { draft: ClientDraft }).draft };
  }
  return { ok: false, message: aresErrorHuman(payload) };
}

export function SubmitRow(props: {
  pending: boolean;
  sourceLabel?: string;
  label?: string;
}) {
  return (
    <div className="flex gap-2">
      <Button disabled={props.pending} type="submit">
        {props.pending ? "Ukládám…" : (props.label ?? "Uložit")}
      </Button>
      {props.sourceLabel ? (
        <span className="text-muted-foreground flex items-center text-xs">
          Zdroj: {props.sourceLabel}
        </span>
      ) : null}
    </div>
  );
}
