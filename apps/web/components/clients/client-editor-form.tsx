"use client";

import { saveClient } from "@/actions/clients";
import {
  formatAresLookupError,
  lookupAresByIco,
  lookupMessageFromInvalid,
} from "@/components/issuers/issuer-form-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClientSnapshot } from "@invoicey/invoice-core/schema";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("Clients.form");
  const tErr = useTranslations("Errors.invalid");
  const tAres = useTranslations("Issuers.ares");
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
  const [lookupMsg, setLookupMsg] = React.useState<string | null>(null);
  const [lookingUp, setLookingUp] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function onLookupFromAres() {
    if (lookingUp || saving) {
      return;
    }
    setLookupMsg(null);
    setLookingUp(true);
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
      setCountry(draft.address.country);
      setContactEmail(draft.contactEmail ?? "");
      if (draft.ico !== undefined && draft.ico.length > 0) {
        setIcoInput(draft.ico);
      }
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
    lookupMsg ?? lookupMessageFromInvalid(invalidQuery ?? undefined, tErr);

  return (
    <form className="mx-auto max-w-xl space-y-6" onSubmit={onSubmit}>
      {userMsg ? <p className="text-destructive text-sm">{userMsg}</p> : null}

      <div className="space-y-2">
        <Label htmlFor="client-ico">{t("ico")}</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="client-ico"
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
            {lookingUp ? t("lookingUp") : t("lookup")}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">{t("icoHint")}</p>
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
              setCountry(ev.target.value.toUpperCase());
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
          type="email"
          value={contactEmail}
        />
      </FieldGroup>

      <div className="flex gap-2">
        <Button disabled={lookingUp} loading={saving} type="submit">
          {saving ? t("saving") : t("save")}
        </Button>
        <span className="text-muted-foreground flex items-center text-xs">
          {t("source", {
            source: source === "ares" ? t("sourceAres") : t("sourceManual"),
          })}
        </span>
      </div>
    </form>
  );
}

function FieldGroup(props: { label: string; children: React.ReactNode }) {
  const generatedId = React.useId();
  const generatedControlId = `client-field-${generatedId.replaceAll(":", "")}`;
  const childArray = React.Children.toArray(props.children);
  const controlIndex = childArray.findIndex(React.isValidElement);
  const control = childArray[controlIndex] as
    React.ReactElement<{ id?: string }> | undefined;
  const controlId = control?.props.id ?? generatedControlId;
  const children = childArray.map((child, index) => {
    if (index !== controlIndex || !React.isValidElement(child)) {
      return child;
    }
    const element = child as React.ReactElement<{ id?: string }>;
    return React.cloneElement(element, { id: controlId });
  });

  return (
    <div className="space-y-2">
      <Label htmlFor={controlId}>{props.label}</Label>
      {children}
    </div>
  );
}
