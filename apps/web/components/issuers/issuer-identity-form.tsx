"use client";

import { saveIssuerIdentity } from "@/actions/issuers";
import {
  FieldGroup,
  formatAresLookupError,
  lookupAresByIco,
  SubmitRow,
  useInvalidQueryMessage,
} from "@/components/issuers/issuer-form-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { IssuerSnapshot } from "@invoicey/invoice-core/schema";
import { useTranslations } from "next-intl";
import type { FormEvent } from "react";
import * as React from "react";

export function IssuerIdentityForm(props: {
  snapshot: IssuerSnapshot;
  source: string;
  invalidQuery?: string | null;
}) {
  const t = useTranslations("Issuers.form");
  const tAres = useTranslations("Issuers.ares");
  const { snapshot } = props;
  const [pending, startTransition] = React.useTransition();
  const [source, setSource] = React.useState<"ares" | "manual">(
    props.source === "ares" ? "ares" : "manual",
  );
  const [icoInput, setIcoInput] = React.useState(snapshot.ico);
  const [name, setName] = React.useState(snapshot.name);
  const [dic, setDic] = React.useState(snapshot.dic ?? "");
  const [street, setStreet] = React.useState(snapshot.address.street);
  const [city, setCity] = React.useState(snapshot.address.city);
  const [zip, setZip] = React.useState(snapshot.address.zip);
  const [country, setCountry] = React.useState(snapshot.address.country);
  const [contactEmail, setContactEmail] = React.useState(snapshot.contactEmail);
  const [vatPayer, setVatPayer] = React.useState(snapshot.vatPayer);
  const [registryNote, setRegistryNote] = React.useState(
    snapshot.registryNote ??
      (snapshot.vatPayer ? "" : t("courtRecordPlaceholder")),
  );
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
      setCountry(draft.address.country === "CZ" ? "CZ" : "CZ");
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
    fd.set("id", snapshot.id);
    fd.set("source", source);
    fd.set("name", name);
    fd.set("ico", icoInput.trim());
    if (dic.trim()) {
      fd.set("dic", dic.trim());
    }
    fd.set("street", street);
    fd.set("city", city);
    fd.set("zip", zip);
    fd.set("country", country);
    fd.set("contactEmail", contactEmail.trim());
    fd.set("vatPayer", vatPayer ? "true" : "false");
    if (registryNote.trim()) {
      fd.set("registryNote", registryNote.trim());
    }
    startTransition(async () => {
      await saveIssuerIdentity(fd);
    });
  }

  const invalidFromQuery = useInvalidQueryMessage(props.invalidQuery);
  const userMsg = lookupMsg ?? invalidFromQuery;

  return (
    <form className="max-w-2xl space-y-6" onSubmit={onSubmit}>
      {userMsg ? <p className="text-destructive text-sm">{userMsg}</p> : null}

      <div className="space-y-2">
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
      </div>

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
        <FieldGroup label={t("country")}>
          <Input
            maxLength={2}
            onChange={(ev) => {
              setCountry(ev.target.value.toUpperCase() === "CZ" ? "CZ" : "CZ");
            }}
            required
            value={country}
          />
        </FieldGroup>
      </div>

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
        <p className="text-muted-foreground text-xs">{t("courtRecordHint")}</p>
      </FieldGroup>

      <SubmitRow
        pending={pending}
        sourceLabel={source === "ares" ? t("sourceAres") : t("sourceManual")}
      />
    </form>
  );
}
