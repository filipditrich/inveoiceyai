"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploadField } from "@/components/upload/image-upload-field";
import {
  DEFAULT_TEMPLATES,
  DOC_TYPES,
  type NumberingSchemeDraft,
} from "@/lib/issuer-types";
import { useTranslations } from "next-intl";

import type { ClientDraft } from "@invoicey/ares";
import {
  IcoSchema,
  isValidCzIban,
  suggestCzIban,
} from "@invoicey/invoice-core/schema";

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
  const t = useTranslations("Issuers.form");
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
      ? t("accountHint")
      : null;
  const ibanHint =
    iban.trim() && !isValidCzIban(iban)
      ? t("ibanInvalid")
      : autoIban && iban === autoIban
        ? t("ibanFilled")
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
  const t = useTranslations("Issuers.form");
  return (
    <>
      <FieldGroup label={t("accountNumber")}>
        <Input
          onChange={(ev) => {
            props.onAccountNumber(ev.target.value);
          }}
          required={props.required}
          value={props.accountNumber}
        />
        {props.accountHint ? (
          <p className="text-xs text-muted-foreground">{props.accountHint}</p>
        ) : null}
      </FieldGroup>
      <FieldGroup label={t("iban")}>
        <Input
          onChange={(ev) => {
            props.onIban(ev.target.value);
          }}
          required={props.required}
          value={props.iban}
        />
        {props.ibanHint ? (
          <p className="text-xs text-muted-foreground">{props.ibanHint}</p>
        ) : null}
      </FieldGroup>
      <FieldGroup label={t("bic")}>
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
  const t = useTranslations("Issuers.form");

  return (
    <div className="space-y-3">
      <Label>{props.label}</Label>
      {props.uploadConfigured ? (
        <ImageUploadField
          alt={props.label}
          endpoint={props.endpoint}
          onUrl={(next) => {
            props.onUrl(next ?? "");
          }}
          url={props.url}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("uploadUnavailable")}
        </p>
      )}
    </div>
  );
}

const INVALID_MESSAGE_KEYS = [
  "required_fields",
  "missing_parties",
  "validation",
  "missing_scheme",
  "already_issued",
  "not_draft",
  "cannot_issue",
  "has_invoices",
  "bad_ico",
  "bad_dic",
  "bad_bank",
  "snapshot_validation",
  "missing_row",
  "save_failed",
] as const;

export function lookupMessageFromInvalid(
  inv: string | null | undefined,
  t: (key: "generic", values: { code: string }) => string,
): string | null {
  if (!inv) {
    return null;
  }
  if ((INVALID_MESSAGE_KEYS as readonly string[]).includes(inv)) {
    return (t as (key: string) => string)(inv);
  }
  return t("generic", { code: inv });
}

export function useInvalidQueryMessage(
  invalidQuery?: string | null,
): string | null {
  const t = useTranslations("Errors.invalid");
  return lookupMessageFromInvalid(invalidQuery, t);
}

export type AresLookupCode =
  | "invalid_ico"
  | "ares_no_json"
  | "ares_no_data"
  | "ares_failed";

export type AresLookupResult =
  | { ok: true; draft: ClientDraft }
  | { ok: false; code: AresLookupCode; serverMessage?: string };

export function formatAresLookupError(
  result: Extract<AresLookupResult, { ok: false }>,
  t: (key: AresLookupCode) => string,
): string {
  return result.serverMessage ?? t(result.code);
}

function aresErrorFromPayload(
  payload: unknown,
): Extract<AresLookupResult, { ok: false }> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, code: "ares_no_data" };
  }
  const maybe = payload as { message?: unknown };
  if (typeof maybe.message === "string") {
    return { ok: false, code: "ares_failed", serverMessage: maybe.message };
  }
  return { ok: false, code: "ares_failed" };
}

export type AresFillResult = {
  draft: ClientDraft;
};

/** Shared ARES IČO lookup used by identity / create / welcome forms. */
export async function lookupAresByIco(
  icoInput: string,
): Promise<AresLookupResult> {
  const raw = (icoInput ?? "").replace(/\s/g, "");
  const parsed = IcoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "invalid_ico" };
  }
  const res = await fetch(`/api/ares/${parsed.data}`);
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return { ok: false, code: "ares_no_json" };
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
  return aresErrorFromPayload(payload);
}

export function SubmitRow(props: {
  pending: boolean;
  sourceLabel?: string;
  label?: string;
}) {
  const t = useTranslations("Issuers.form");
  return (
    <div className="flex gap-2">
      <Button disabled={props.pending} type="submit">
        {props.pending ? t("saving") : (props.label ?? t("save"))}
      </Button>
      {props.sourceLabel ? (
        <span className="flex items-center text-xs text-muted-foreground">
          {t("source", { source: props.sourceLabel })}
        </span>
      ) : null}
    </div>
  );
}
