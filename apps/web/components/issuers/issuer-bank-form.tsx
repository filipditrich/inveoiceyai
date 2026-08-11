"use client";

import { saveIssuerBank } from "@/actions/issuers";
import {
  FieldGroup,
  lookupMessageFromInvalid,
  SubmitRow,
} from "@/components/issuers/issuer-form-shared";
import { Input } from "@/components/ui/input";
import type { IssuerSnapshot } from "@invoicey/invoice-core/schema";
import type { FormEvent } from "react";
import * as React from "react";

export function IssuerBankForm(props: {
  snapshot: IssuerSnapshot;
  invalidQuery?: string | null;
}) {
  const { snapshot } = props;
  const [pending, startTransition] = React.useTransition();
  const [accountNumber, setAccountNumber] = React.useState(
    snapshot.bank.accountNumber,
  );
  const [iban, setIban] = React.useState(snapshot.bank.iban);
  const [bic, setBic] = React.useState(snapshot.bank.bic ?? "");
  const userMsg = lookupMessageFromInvalid(props.invalidQuery);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("id", snapshot.id);
    fd.set("accountNumber", accountNumber.trim());
    fd.set("iban", iban.trim());
    if (bic.trim()) {
      fd.set("bic", bic.trim());
    }
    startTransition(async () => {
      await saveIssuerBank(fd);
    });
  }

  return (
    <form className="max-w-2xl space-y-6" onSubmit={onSubmit}>
      {userMsg ? <p className="text-destructive text-sm">{userMsg}</p> : null}
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
      <SubmitRow pending={pending} />
    </form>
  );
}
