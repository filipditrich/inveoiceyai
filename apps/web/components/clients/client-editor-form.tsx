"use client";

import { saveClient } from "@/actions/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClientDraft } from "@invoicey/ares";
import type { ClientSnapshot } from "@invoicey/invoice-core/schema";
import { IcoSchema } from "@invoicey/invoice-core/schema";
import type { FormEvent } from "react";
import * as React from "react";

export interface ClientEditorFormProps {
  mode: "create" | "edit";
  invalidQuery?: string | null;
  snapshot?: ClientSnapshot;
}

export function ClientEditorForm({
  mode,
  invalidQuery,
  snapshot,
}: ClientEditorFormProps) {
  const [createdId] = React.useState(() => crypto.randomUUID());
  const persistedId = mode === "edit" ? (snapshot?.id ?? "") : createdId;

  if (mode === "edit" && persistedId.length === 0) {
    throw new Error("ClientEditorForm(edit) requires snapshot.id");
  }

  const [source, setSource] = React.useState<"ares" | "manual">(() => "manual");
  const [icoInput, setIcoInput] = React.useState(snapshot?.ico ?? "");
  const [name, setName] = React.useState(snapshot?.name ?? "");
  const [dic, setDic] = React.useState(snapshot?.dic ?? "");
  const [street, setStreet] = React.useState(snapshot?.address.street ?? "");
  const [city, setCity] = React.useState(snapshot?.address.city ?? "");
  const [zip, setZip] = React.useState(snapshot?.address.zip ?? "");
  const [country, setCountry] = React.useState(
    snapshot?.address.country ?? "CZ",
  );
  const [contactEmail, setContactEmail] = React.useState(
    snapshot?.contactEmail ?? "",
  );
  const [lookupMsg, setLookupMsg] = React.useState<string | null>(() =>
    lookupMessageFromInvalid(invalidQuery),
  );
  const [lookingUp, setLookingUp] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function onLookupFromAres() {
    if (lookingUp || saving) {
      return;
    }
    setLookupMsg(null);
    const raw = (icoInput ?? "").replace(/\s/g, "");
    const parsed = IcoSchema.safeParse(raw);
    if (!parsed.success) {
      setLookupMsg("Zadejte platné osmimístné IČO.");
      return;
    }
    setLookingUp(true);
    try {
      const res = await fetch(`/api/ares/${parsed.data}`);
      let payload: unknown;
      try {
        payload = await res.json();
      } catch {
        setLookupMsg("ARES nevrátila JSON.");
        return;
      }
      if (
        payload &&
        typeof payload === "object" &&
        "ok" in payload &&
        payload.ok === true &&
        "draft" in payload
      ) {
        const draft = (payload as { draft: ClientDraft }).draft;
        setSource("ares");
        setName(draft.name);
        setDic(draft.dic ?? "");
        setStreet(draft.address.street);
        setCity(draft.address.city);
        setZip(draft.address.zip);
        setCountry(draft.address.country);
        setContactEmail(draft.contactEmail ?? "");
        if (draft.ico !== undefined && draft.ico.length > 0) {
          setIcoInput(draft.ico);
        }
        return;
      }
      setLookupMsg(aresErrorHuman(payload));
    } finally {
      setLookingUp(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || lookingUp) {
      return;
    }
    const fd = new FormData();
    fd.set("id", persistedId);
    fd.set("source", source);
    fd.set("name", name);
    if (icoInput.trim().length > 0) {
      fd.set("ico", icoInput.trim());
    }
    if (dic.trim().length > 0) {
      fd.set("dic", dic.trim());
    }
    fd.set("street", street);
    fd.set("city", city);
    fd.set("zip", zip);
    fd.set("country", country.trim().length > 0 ? country.trim() : "CZ");
    if (contactEmail.trim().length > 0) {
      fd.set("contactEmail", contactEmail.trim());
    }
    setSaving(true);
    try {
      await saveClient(fd);
    } finally {
      setSaving(false);
    }
  }

  const userMsg =
    lookupMsg ?? lookupMessageFromInvalid(invalidQuery ?? undefined);

  return (
    <form className="mx-auto max-w-xl space-y-6" onSubmit={onSubmit}>
      {userMsg ? <p className="text-destructive text-sm">{userMsg}</p> : null}

      <div className="space-y-2">
        <Label>IČO (ARES)</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            maxLength={8}
            onChange={(ev) => {
              setIcoInput(ev.target.value);
            }}
            inputMode="numeric"
            pattern="\d{0,8}"
            placeholder="12345678"
            value={icoInput}
          />
          <Button
            disabled={saving}
            loading={lookingUp}
            onClick={() => void onLookupFromAres()}
            type="button"
            variant="secondary"
          >
            {lookingUp ? "Hledám…" : "Lookup"}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Předvyplnění z ARES, nebo ruční záznam bez ARES (např. 404).
        </p>
      </div>

      <FieldGroup label="Název">
        <Input
          onChange={(ev) => {
            setName(ev.target.value);
          }}
          required
          value={name}
        />
      </FieldGroup>

      <FieldGroup label="DIČ">
        <Input
          onChange={(ev) => {
            setDic(ev.target.value);
          }}
          value={dic}
        />
      </FieldGroup>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldGroup label="Ulice a číslo">
          <Input
            onChange={(ev) => {
              setStreet(ev.target.value);
            }}
            required
            value={street}
          />
        </FieldGroup>
        <FieldGroup label="Město">
          <Input
            onChange={(ev) => {
              setCity(ev.target.value);
            }}
            required
            value={city}
          />
        </FieldGroup>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldGroup label="PSČ">
          <Input
            onChange={(ev) => {
              setZip(ev.target.value);
            }}
            required
            value={zip}
          />
        </FieldGroup>
        <FieldGroup label="Stát (ISO)">
          <Input
            maxLength={2}
            onChange={(ev) => {
              setCountry(ev.target.value.toUpperCase());
            }}
            required
            value={country}
          />
        </FieldGroup>
      </div>

      <FieldGroup label="Kontaktní e-mail">
        <Input
          onChange={(ev) => {
            setContactEmail(ev.target.value);
          }}
          type="email"
          value={contactEmail}
        />
      </FieldGroup>

      <div className="flex gap-2">
        <Button disabled={lookingUp} loading={saving} type="submit">
          {saving ? "Ukládám…" : "Save"}
        </Button>
        <span className="text-muted-foreground flex items-center text-xs">
          Zdroj: {source === "ares" ? "ARES" : "Ručně"}
        </span>
      </div>
    </form>
  );
}

function FieldGroup(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      {props.children}
    </div>
  );
}

function lookupMessageFromInvalid(
  inv: string | null | undefined,
): string | null {
  if (!inv) {
    return null;
  }
  if (inv === "required_fields") {
    return "Vyplňte povinná pole.";
  }
  if (inv === "bad_ico") {
    return "Neplatné IČO.";
  }
  if (inv === "bad_dic") {
    return "Neplatné DIČ.";
  }
  if (inv === "snapshot_validation") {
    return "Údaje neodpovídají fakturačnímu schématu.";
  }
  if (inv === "missing_row") {
    return "Záznam nenalezen.";
  }
  return `Chyba: ${inv}`;
}

function aresErrorHuman(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "ARES nevrátila data.";
  }
  const maybe = payload as {
    message?: unknown;
  };
  if ("message" in maybe && typeof maybe.message === "string") {
    return maybe.message;
  }
  return "Vyhledání v ARES se nezdařilo.";
}
