"use client";

import * as React from "react";
import { Field } from "@/components/invoices/field";
import {
  formatAresLookupError,
  lookupAresByIco,
} from "@/components/issuers/issuer-form-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  applyAresToParty,
  type GeneratorIssuer,
  type GeneratorParty,
} from "@/lib/generator/draft";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { suggestCzIban } from "@invoicey/invoice-core/schema";

type PartyKind = "issuer" | "client";

export function PartyFields({
  kind,
  party,
  issuer,
  onParty,
  onIssuer,
}: {
  kind: PartyKind;
  party: GeneratorParty;
  issuer?: GeneratorIssuer;
  onParty?: (next: GeneratorParty) => void;
  onIssuer?: (next: GeneratorIssuer) => void;
}) {
  const t = useTranslations("Generator");
  const tAres = useTranslations("Issuers.ares");
  const [pending, setPending] = React.useState(false);
  const [lookupMsg, setLookupMsg] = React.useState<string | null>(null);

  function commitParty(next: GeneratorParty) {
    if (kind === "issuer" && issuer && onIssuer) {
      onIssuer({ ...issuer, ...next });
      return;
    }
    onParty?.(next);
  }

  async function onLookup() {
    setLookupMsg(null);
    setPending(true);
    try {
      const result = await lookupAresByIco(party.ico, {
        endpoint: "generator",
      });
      if (!result.ok) {
        setLookupMsg(formatAresLookupError(result, tAres));
        return;
      }
      const next = applyAresToParty(party, result.draft);
      commitParty(next);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">
        {kind === "issuer" ? t("issuer") : t("client")}
      </h2>
      {lookupMsg ? (
        <p className="text-sm text-destructive" role="alert">
          {lookupMsg}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <Field className="min-w-[12rem]" label={t("ico")}>
          <Input
            className="max-w-xs"
            inputMode="numeric"
            maxLength={8}
            onChange={(ev) =>
              commitParty({
                ...party,
                ico: ev.target.value.replace(/\D/gu, ""),
              })
            }
            value={party.ico}
          />
        </Field>
        <Button
          disabled={pending}
          loading={pending}
          onClick={() => void onLookup()}
          type="button"
          variant="outline"
        >
          <SearchIcon data-icon="inline-start" />
          {pending ? t("lookingUp") : t("lookupAres")}
        </Button>
      </div>
      <Field label={t("name")}>
        <Input
          onChange={(ev) => commitParty({ ...party, name: ev.target.value })}
          value={party.name}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("street")}>
          <Input
            onChange={(ev) =>
              commitParty({ ...party, street: ev.target.value })
            }
            value={party.street}
          />
        </Field>
        <Field label={t("city")}>
          <Input
            onChange={(ev) => commitParty({ ...party, city: ev.target.value })}
            value={party.city}
          />
        </Field>
        <Field label={t("zip")}>
          <Input
            onChange={(ev) => commitParty({ ...party, zip: ev.target.value })}
            value={party.zip}
          />
        </Field>
        <Field label={t("country")}>
          <Input
            disabled={kind === "issuer"}
            maxLength={2}
            onChange={(ev) =>
              commitParty({
                ...party,
                country: ev.target.value.toUpperCase(),
              })
            }
            value={kind === "issuer" ? "CZ" : party.country}
          />
        </Field>
      </div>
      <Field label={t("dic")}>
        <Input
          onChange={(ev) => commitParty({ ...party, dic: ev.target.value })}
          value={party.dic}
        />
      </Field>
      <Field label={t("contactEmail")}>
        <Input
          onChange={(ev) =>
            commitParty({ ...party, contactEmail: ev.target.value })
          }
          type="email"
          value={party.contactEmail}
        />
      </Field>
      {kind === "issuer" && issuer && onIssuer ? (
        <IssuerExtras issuer={issuer} onIssuer={onIssuer} />
      ) : null}
    </section>
  );
}

function IssuerExtras({
  issuer,
  onIssuer,
}: {
  issuer: GeneratorIssuer;
  onIssuer: (next: GeneratorIssuer) => void;
}) {
  const t = useTranslations("Generator");

  function onAccount(accountNumber: string) {
    const suggested = suggestCzIban(accountNumber);
    onIssuer({
      ...issuer,
      accountNumber,
      iban: issuer.ibanTouched || !suggested ? issuer.iban : suggested,
    });
  }

  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <input
          checked={issuer.vatPayer}
          onChange={(ev) =>
            onIssuer({ ...issuer, vatPayer: ev.target.checked })
          }
          type="checkbox"
        />
        {t("vatPayer")}
      </label>
      <Field label={t("accountNumber")}>
        <Input
          onChange={(ev) => onAccount(ev.target.value)}
          value={issuer.accountNumber}
        />
      </Field>
      <Field label={t("iban")}>
        <Input
          onChange={(ev) =>
            onIssuer({
              ...issuer,
              iban: ev.target.value.replace(/\s+/gu, "").toUpperCase(),
              ibanTouched: true,
            })
          }
          value={issuer.iban}
        />
      </Field>
    </>
  );
}
