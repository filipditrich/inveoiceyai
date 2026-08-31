"use client";

import { createIssuer } from "@/actions/issuers";
import {
  BankAccountFields,
  FieldGroup,
  formatAresLookupError,
  lookupAresByIco,
  SubmitRow,
  useCzechIbanSuggest,
  useInvalidQueryMessage,
} from "@/components/issuers/issuer-form-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";
import type { FormEvent } from "react";
import * as React from "react";

/** Minimal create: identity (ARES) + bank + contact email; numbering/email defaults. */
export function IssuerCreateForm(props: {
  invalidQuery?: string | null;
  /** When set, createIssuer redirects to welcome done step. */
  next?: "welcome";
}) {
  const t = useTranslations("Issuers.form");
  const tAres = useTranslations("Issuers.ares");
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
  const bank = useCzechIbanSuggest();
  const [bic, setBic] = React.useState("");
  const [vatPayer, setVatPayer] = React.useState(true);
  const [registryNote, setRegistryNote] = React.useState("");
  const [lookupPending, setLookupPending] = React.useState(false);
  const [lookupMsg, setLookupMsg] = React.useState<string | null>(null);

  async function onLookupFromAres() {
    setLookupMsg(null);
    setLookupPending(true);
    try {
      const result = await lookupAresByIco(icoInput);
      if (!result.ok) {
        setLookupMsg(formatAresLookupError(result, tAres));
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
    fd.set("accountNumber", bank.accountNumber.trim());
    fd.set("iban", bank.iban.trim());
    if (bic.trim()) {
      fd.set("bic", bic.trim());
    }
    fd.set("vatPayer", vatPayer ? "true" : "false");
    if (registryNote.trim()) {
      fd.set("registryNote", registryNote.trim());
    }
    if (props.next) {
      fd.set("next", props.next);
    }
    startTransition(async () => {
      await createIssuer(fd);
    });
  }

  const invalidFromQuery = useInvalidQueryMessage(props.invalidQuery);
  const userMsg = lookupMsg ?? invalidFromQuery;

  return (
    <form className="mx-auto max-w-2xl space-y-8" onSubmit={onSubmit}>
      {userMsg ? <p className="text-destructive text-sm">{userMsg}</p> : null}

      <section className="space-y-4">
        <h2 className="text-lg font-medium">{t("identitySection")}</h2>
        <FieldGroup label={t("icoAres")}>
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
              {lookupPending ? t("lookingUp") : t("lookup")}
            </Button>
          </div>
        </FieldGroup>

        <FieldGroup label={t("name")}>
          <Input
            onChange={(ev) => {
              setName(ev.target.value);
            }}
            required
            value={name}
          />
        </FieldGroup>

        <FieldGroup label={t("dic")}>
          <Input
            onChange={(ev) => {
              setDic(ev.target.value);
            }}
            placeholder="CZ12345678"
            value={dic}
          />
        </FieldGroup>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup label={t("street")}>
            <Input
              onChange={(ev) => {
                setStreet(ev.target.value);
              }}
              required
              value={street}
            />
          </FieldGroup>
          <FieldGroup label={t("city")}>
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
          <FieldGroup label={t("zip")}>
            <Input
              onChange={(ev) => {
                setZip(ev.target.value);
              }}
              required
              value={zip}
            />
          </FieldGroup>
          <FieldGroup label={t("contactEmail")}>
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
              if (!ev.target.checked && registryNote.trim() === "") {
                setRegistryNote(t("courtRecordPlaceholder"));
              }
            }}
            type="checkbox"
          />
          {t("vatPayer")}
        </label>
        <FieldGroup label={t("courtRecord")}>
          <Input
            onChange={(ev) => {
              setRegistryNote(ev.target.value);
            }}
            placeholder={t("courtRecordPlaceholder")}
            value={registryNote}
          />
          <p className="text-muted-foreground text-xs">
            {t("courtRecordHint")}
          </p>
        </FieldGroup>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">{t("bankSection")}</h2>
        <BankAccountFields
          accountHint={bank.accountHint}
          accountNumber={bank.accountNumber}
          bic={bic}
          iban={bank.iban}
          ibanHint={bank.ibanHint}
          onAccountNumber={bank.setAccountNumber}
          onBic={setBic}
          onIban={bank.setIban}
          required
        />
      </section>

      <p className="text-muted-foreground text-xs">{t("defaultsHint")}</p>

      <SubmitRow
        label={t("create")}
        pending={pending}
        sourceLabel={source === "ares" ? t("sourceAres") : t("sourceManual")}
      />
    </form>
  );
}
