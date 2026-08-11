"use client";

import { saveIssuerNumbering } from "@/actions/issuers";
import {
  FieldGroup,
  lookupMessageFromInvalid,
  SubmitRow,
} from "@/components/issuers/issuer-form-shared";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_TEMPLATES,
  DOC_TYPES,
  type NumberingSchemeDraft,
} from "@/lib/issuer-types";
import { nextInvoiceNumber } from "@invoicey/invoice-core/numbering";
import type { FormEvent } from "react";
import * as React from "react";

export function IssuerNumberingForm(props: {
  issuerId: string;
  issuerName: string;
  schemes: NumberingSchemeDraft[];
  invalidQuery?: string | null;
}) {
  const [pending, startTransition] = React.useTransition();
  const yearNow = new Date().getFullYear();
  const [schemeState, setSchemeState] = React.useState(() => {
    const map = new Map(props.schemes.map((s) => [s.docType, s]));
    return DOC_TYPES.map((d) => {
      const existing = map.get(d.key);
      return {
        docType: d.key,
        template: existing?.template ?? DEFAULT_TEMPLATES[d.key],
        resetPeriod: existing?.resetPeriod ?? ("yearly" as const),
        counter: existing?.counter ?? 0,
        counterYear: existing?.counterYear ?? yearNow,
        padding: existing?.padding ?? 4,
      };
    });
  });
  const userMsg = lookupMessageFromInvalid(props.invalidQuery);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("id", props.issuerId);
    for (const s of schemeState) {
      fd.set(`scheme_${s.docType}_template`, s.template);
      fd.set(`scheme_${s.docType}_resetPeriod`, s.resetPeriod);
      fd.set(`scheme_${s.docType}_counter`, String(s.counter));
      fd.set(`scheme_${s.docType}_padding`, String(s.padding));
      if (s.resetPeriod === "yearly" && s.counterYear != null) {
        fd.set(`scheme_${s.docType}_counterYear`, String(s.counterYear));
      }
    }
    startTransition(async () => {
      await saveIssuerNumbering(fd);
    });
  }

  return (
    <form className="max-w-2xl space-y-6" onSubmit={onSubmit}>
      {userMsg ? <p className="text-destructive text-sm">{userMsg}</p> : null}
      <p className="text-muted-foreground text-xs">
        Tokeny: {"{YYYY}"} {"{YY}"} {"{MM}"} {"{DD}"} {"{####}"} {"{ISSUER}"}{" "}
        {"{TYPE}"}. Ruční změna counteru může vytvořit mezery v řadě.
      </p>
      {schemeState.map((s, idx) => {
        const label =
          DOC_TYPES.find((d) => d.key === s.docType)?.label ?? s.docType;
        const initialCounter =
          props.schemes.find((x) => x.docType === s.docType)?.counter ?? 0;
        let nextPreview = "—";
        try {
          nextPreview = nextInvoiceNumber(
            {
              template: s.template,
              counter: s.counter,
              counterYear: s.counterYear ?? undefined,
              resetPeriod: s.resetPeriod,
              padding: s.padding,
              docType: s.docType,
              issuerName: props.issuerName || "Issuer",
            },
            new Date(),
          );
        } catch {
          nextPreview = "(neplatná šablona)";
        }
        return (
          <div className="space-y-2 rounded-md border p-3" key={s.docType}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-muted-foreground text-xs tabular-nums">
                Další číslo:{" "}
                <span className="text-foreground font-medium">
                  {nextPreview}
                </span>
              </p>
            </div>
            {s.counter !== initialCounter ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Counter byl změněn — zkontrolujte, že nevzniknou duplicity nebo
                mezery.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldGroup label="Šablona">
                <Input
                  onChange={(ev) => {
                    setSchemeState((prev) => {
                      const next = [...prev];
                      const cur = next[idx];
                      if (!cur) {
                        return prev;
                      }
                      next[idx] = { ...cur, template: ev.target.value };
                      return next;
                    });
                  }}
                  value={s.template}
                />
              </FieldGroup>
              <FieldGroup label="Padding (#)">
                <Input
                  min={1}
                  max={10}
                  onChange={(ev) => {
                    const n = Number(ev.target.value);
                    setSchemeState((prev) => {
                      const next = [...prev];
                      const cur = next[idx];
                      if (!cur) {
                        return prev;
                      }
                      next[idx] = {
                        ...cur,
                        padding: Number.isFinite(n) ? n : 4,
                      };
                      return next;
                    });
                  }}
                  type="number"
                  value={s.padding}
                />
              </FieldGroup>
              <FieldGroup label="Reset">
                <select
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  onChange={(ev) => {
                    const v = ev.target.value === "never" ? "never" : "yearly";
                    setSchemeState((prev) => {
                      const next = [...prev];
                      const cur = next[idx];
                      if (!cur) {
                        return prev;
                      }
                      next[idx] = { ...cur, resetPeriod: v };
                      return next;
                    });
                  }}
                  value={s.resetPeriod}
                >
                  <option value="yearly">Roční</option>
                  <option value="never">Nikdy</option>
                </select>
              </FieldGroup>
              <FieldGroup label="Counter">
                <Input
                  min={0}
                  onChange={(ev) => {
                    const n = Number(ev.target.value);
                    setSchemeState((prev) => {
                      const next = [...prev];
                      const cur = next[idx];
                      if (!cur) {
                        return prev;
                      }
                      next[idx] = {
                        ...cur,
                        counter: Number.isFinite(n) ? n : 0,
                      };
                      return next;
                    });
                  }}
                  type="number"
                  value={s.counter}
                />
              </FieldGroup>
              {s.resetPeriod === "yearly" ? (
                <FieldGroup label="Counter year">
                  <Input
                    onChange={(ev) => {
                      const n = Number(ev.target.value);
                      setSchemeState((prev) => {
                        const next = [...prev];
                        const cur = next[idx];
                        if (!cur) {
                          return prev;
                        }
                        next[idx] = {
                          ...cur,
                          counterYear: Number.isFinite(n) ? n : yearNow,
                        };
                        return next;
                      });
                    }}
                    type="number"
                    value={s.counterYear ?? yearNow}
                  />
                </FieldGroup>
              ) : null}
            </div>
          </div>
        );
      })}
      <SubmitRow pending={pending} />
    </form>
  );
}
