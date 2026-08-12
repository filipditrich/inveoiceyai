"use client";

import { saveIssuerBank } from "@/actions/issuers";
import {
  BankAccountFields,
  lookupMessageFromInvalid,
  SubmitRow,
  useCzechIbanSuggest,
} from "@/components/issuers/issuer-form-shared";
import type { IssuerSnapshot } from "@invoicey/invoice-core/schema";
import type { FormEvent } from "react";
import * as React from "react";

export function IssuerBankForm(props: {
  snapshot: IssuerSnapshot;
  invalidQuery?: string | null;
}) {
  const { snapshot } = props;
  const [pending, startTransition] = React.useTransition();
  const bank = useCzechIbanSuggest(
    snapshot.bank.accountNumber,
    snapshot.bank.iban,
  );
  const [bic, setBic] = React.useState(snapshot.bank.bic ?? "");
  const userMsg = lookupMessageFromInvalid(props.invalidQuery);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("id", snapshot.id);
    fd.set("accountNumber", bank.accountNumber.trim());
    fd.set("iban", bank.iban.trim());
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
      <SubmitRow pending={pending} />
    </form>
  );
}
