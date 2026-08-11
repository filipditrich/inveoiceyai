"use client";

import { createIssuer } from "@/actions/issuers";
import {
  FieldGroup,
  lookupAresByIco,
  lookupMessageFromInvalid,
  SubmitRow,
} from "@/components/issuers/issuer-form-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormEvent } from "react";
import * as React from "react";

/** Minimal create: identity (ARES) + bank + contact email; numbering/email defaults. */
export function IssuerCreateForm(props: {
  invalidQuery?: string | null;
  /** When set, createIssuer redirects to welcome done step. */
  next?: "welcome";
}) {
  const [createdId] = React.useState(() => crypto.randomUUID());
  const [pending, startTransition] = React.useTransition();
  const [source, setSource] = React.useState<"ares" | "manual">("manual");
  const [icoInput, setIcoInput] = React.useState("");
  const [name, setName] = React.useState("");
  const [dic, setDic] = React.useState("");
  const [street, setStreet] = React.useState("");
  const [city, setCity] = React.useState("");
  const [zip, setZip] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [iban, setIban] = React.useState("");
  const [bic, setBic] = React.useState("");
  const [vatPayer, setVatPayer] = React.useState(true);
  const [lookupPending, setLookupPending] = React.useState(false);
  const [lookupMsg, setLookupMsg] = React.useState<string | null>(() =>
    lookupMessageFromInvalid(props.invalidQuery),
  );

  async function onLookupFromAres() {
    setLookupMsg(null);
    setLookupPending(true);
    try {
      const result = await lookupAresByIco(icoInput);
      if (!result.ok) {
        setLookupMsg(result.message);
        return;
      }
      const { draft } = result;
      setSource("ares");
      setName(draft.name);
      setDic(draft.dic ?? "");
      setStreet(draft.address.street);
      setCity(draft.address.city);
      setZip(draft.address.zip);
      if (draft.contactEmail) {
        setContactEmail(draft.contactEmail);
      }
      if (draft.ico) {
        setIcoInput(draft.ico);
      }
    } finally {
      setLookupPending(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("id", createdId);
    fd.set("source", source);
    fd.set("name", name);
    fd.set("ico", icoInput.trim());
    if (dic.trim()) {
      fd.set("dic", dic.trim());
    }
    fd.set("street", street);
    fd.set("city", city);
    fd.set("zip", zip);
    fd.set("contactEmail", contactEmail.trim());
    fd.set("accountNumber", accountNumber.trim());
    fd.set("iban", iban.trim());
    if (bic.trim()) {
      fd.set("bic", bic.trim());
    }
    fd.set("vatPayer", vatPayer ? "true" : "false");
    if (props.next) {
      fd.set("next", props.next);
    }
    startTransition(async () => {
      await createIssuer(fd);
    });
  }

  const userMsg =
    lookupMsg ?? lookupMessageFromInvalid(props.invalidQuery ?? undefined);

  return (
    <form className="mx-auto max-w-2xl space-y-8" onSubmit={onSubmit}>
      {userMsg ? <p className="text-destructive text-sm">{userMsg}</p> : null}

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Identita</h2>
        <FieldGroup label="IČO (ARES)">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              inputMode="numeric"
              maxLength={8}
              onChange={(ev) => {
                setIcoInput(ev.target.value);
              }}
              pattern="\d{0,8}"
              placeholder="12345678"
              required
              value={icoInput}
            />
            <Button
              disabled={lookupPending}
              onClick={() => void onLookupFromAres()}
              type="button"
              variant="secondary"
            >
              {lookupPending ? "Hledám…" : "Načíst z ARES"}
            </Button>
          </div>
        </FieldGroup>

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
            placeholder="CZ12345678"
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
          <FieldGroup label="Kontaktní e-mail">
            <Input
              onChange={(ev) => {
                setContactEmail(ev.target.value);
              }}
              required
              type="email"
              value={contactEmail}
            />
          </FieldGroup>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            checked={vatPayer}
            onChange={(ev) => {
              setVatPayer(ev.target.checked);
            }}
            type="checkbox"
          />
          Plátce DPH
        </label>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Banka</h2>
        <FieldGroup label="Číslo účtu (např. 123456789/0100)">
          <Input
            onChange={(ev) => {
              setAccountNumber(ev.target.value);
            }}
            required
            value={accountNumber}
          />
        </FieldGroup>
        <FieldGroup label="IBAN">
          <Input
            onChange={(ev) => {
              setIban(ev.target.value);
            }}
            required
            value={iban}
          />
        </FieldGroup>
        <FieldGroup label="BIC (volitelné)">
          <Input
            onChange={(ev) => {
              setBic(ev.target.value);
            }}
            value={bic}
          />
        </FieldGroup>
      </section>

      <p className="text-muted-foreground text-xs">
        Číslování a e-mailové šablony nastavíme výchozími hodnotami — upravíte
        je později v nastavení vystavovatele.
      </p>

      <SubmitRow
        label="Vytvořit vystavovatele"
        pending={pending}
        sourceLabel={source === "ares" ? "ARES" : "Ručně"}
      />
    </form>
  );
}
