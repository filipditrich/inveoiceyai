"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_TEMPLATES,
  DOC_TYPES,
  type NumberingSchemeDraft,
} from "@/lib/issuer-types";
import { UploadButton } from "@/lib/uploadthing";
import type { ClientDraft } from "@invoicey/ares";
import { IcoSchema } from "@invoicey/invoice-core/schema";
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

export function AssetField(props: {
  label: string;
  url: string;
  onUrl: (v: string) => void;
  endpoint: "issuerLogo" | "issuerStamp" | "issuerSignature";
  uploadConfigured: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <Input
        onChange={(ev) => {
          props.onUrl(ev.target.value);
        }}
        placeholder="https://…"
        type="url"
        value={props.url}
      />
      {props.uploadConfigured ? (
        <UploadButton
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
      ) : null}
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
