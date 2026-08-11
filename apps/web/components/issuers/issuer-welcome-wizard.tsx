"use client";

import { createIssuer, dismissIssuerWelcome } from "@/actions/issuers";
import {
  FieldGroup,
  lookupAresByIco,
  lookupMessageFromInvalid,
} from "@/components/issuers/issuer-form-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import type { FormEvent } from "react";
import * as React from "react";

type Step = "identity" | "bank" | "done";

export function IssuerWelcomeWizard(props: {
  invalidQuery?: string | null;
  doneIssuerId?: string | null;
}) {
  const [step, setStep] = React.useState<Step>(
    props.doneIssuerId ? "done" : "identity",
  );
  const [createdId] = React.useState(() => crypto.randomUUID());
  const [doneId, setDoneId] = React.useState(props.doneIssuerId ?? "");
  const [pending, startTransition] = React.useTransition();
  const [skipPending, startSkip] = React.useTransition();
  const [lookupPending, setLookupPending] = React.useState(false);

  const [source, setSource] = React.useState<"ares" | "manual">("manual");
  const [icoInput, setIcoInput] = React.useState("");
  const [name, setName] = React.useState("");
  const [dic, setDic] = React.useState("");
  const [street, setStreet] = React.useState("");
  const [city, setCity] = React.useState("");
  const [zip, setZip] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [vatPayer, setVatPayer] = React.useState(true);
  const [accountNumber, setAccountNumber] = React.useState("");
  const [iban, setIban] = React.useState("");
  const [bic, setBic] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(() =>
    lookupMessageFromInvalid(props.invalidQuery),
  );

  async function onLookupFromAres() {
    setMsg(null);
    setLookupPending(true);
    try {
      const result = await lookupAresByIco(icoInput);
      if (!result.ok) {
        setMsg(result.message);
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

  function onIdentityNext(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (
      !icoInput.trim() ||
      !name.trim() ||
      !street.trim() ||
      !city.trim() ||
      !zip.trim() ||
      !contactEmail.trim()
    ) {
      setMsg("Vyplňte povinná pole identity.");
      return;
    }
    setStep("bank");
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!accountNumber.trim() || !iban.trim()) {
      setMsg("Vyplňte bankovní účet a IBAN.");
      return;
    }
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
    fd.set("next", "welcome");
    startTransition(async () => {
      setDoneId(createdId);
      await createIssuer(fd);
    });
  }

  if (step === "done" || props.doneIssuerId) {
    const issuerId = props.doneIssuerId ?? doneId;
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">Krok 3 / 3</p>
          <h1 className="text-2xl font-semibold tracking-tight">Hotovo</h1>
          <p className="text-muted-foreground text-sm">
            Vystavovatel je vytvořen. Číslování a e-mailové šablony mají výchozí
            hodnoty — logo, razítko a další detaily doplníte kdykoli v
            nastavení.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/dashboard" prefetch />} size="sm">
            Přejít na přehled
          </Button>
          {issuerId ? (
            <Button
              render={
                <Link href={`/issuers/${issuerId}/edit/identity`} prefetch />
              }
              size="sm"
              variant="outline"
            >
              Upravit vystavovatele
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">
            Krok {step === "identity" ? "1" : "2"} / 3
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Váš první vystavovatel
          </h1>
          <p className="text-muted-foreground text-sm">
            {step === "identity"
              ? "Načtěte firmu z ARES podle IČO a potvrďte kontaktní e-mail."
              : "Doplňte bankovní účet — potřebujeme ho pro QR platby na fakturách."}
          </p>
        </div>
        <Button
          disabled={skipPending || pending}
          onClick={() => {
            startSkip(async () => {
              await dismissIssuerWelcome();
            });
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          {skipPending ? "Přeskakuji…" : "Přeskočit pro teď"}
        </Button>
      </div>

      {msg ? <p className="text-destructive text-sm">{msg}</p> : null}

      {step === "identity" ? (
        <form className="space-y-4" onSubmit={onIdentityNext}>
          <FieldGroup label="IČO">
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
          <FieldGroup label="Ulice a číslo">
            <Input
              onChange={(ev) => {
                setStreet(ev.target.value);
              }}
              required
              value={street}
            />
          </FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup label="Město">
              <Input
                onChange={(ev) => {
                  setCity(ev.target.value);
                }}
                required
                value={city}
              />
            </FieldGroup>
            <FieldGroup label="PSČ">
              <Input
                onChange={(ev) => {
                  setZip(ev.target.value);
                }}
                required
                value={zip}
              />
            </FieldGroup>
          </div>
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
          <div className="flex gap-2">
            <Button type="submit">Pokračovat</Button>
          </div>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={onCreate}>
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
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending}
              onClick={() => {
                setStep("identity");
              }}
              type="button"
              variant="outline"
            >
              Zpět
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? "Vytvářím…" : "Vytvořit vystavovatele"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
