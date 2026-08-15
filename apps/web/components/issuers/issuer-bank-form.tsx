"use client";

import { saveIssuerBank } from "@/actions/issuers";
import {
  BankAccountFields,
  FieldGroup,
  SubmitRow,
  useCzechIbanSuggest,
  useInvalidQueryMessage,
} from "@/components/issuers/issuer-form-shared";
import { Input } from "@/components/ui/input";
import type { IssuerSnapshot } from "@invoicey/invoice-core/schema";
import { useTranslations } from "next-intl";
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
  const [beneficiaryMessageTemplate, setBeneficiaryMessageTemplate] =
    React.useState(snapshot.paymentQr?.beneficiaryMessageTemplate ?? "");
  const [payerNoteTemplate, setPayerNoteTemplate] = React.useState(
    snapshot.paymentQr?.payerNoteTemplate ?? "",
  );
  const userMsg = useInvalidQueryMessage(props.invalidQuery);
  const t = useTranslations("Issuers.form");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("id", snapshot.id);
    fd.set("accountNumber", bank.accountNumber.trim());
    fd.set("iban", bank.iban.trim());
    if (bic.trim()) {
      fd.set("bic", bic.trim());
    }
    if (beneficiaryMessageTemplate.trim()) {
      fd.set("qrBeneficiaryMessageTemplate", beneficiaryMessageTemplate.trim());
    }
    if (payerNoteTemplate.trim()) {
      fd.set("qrPayerNoteTemplate", payerNoteTemplate.trim());
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
      <section className="space-y-4 rounded-xl border p-4">
        <div className="space-y-1">
          <h2 className="font-medium">{t("qrMessagesTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("qrMessagesHint")}</p>
        </div>
        <FieldGroup label={t("qrBeneficiaryMessage")}>
          <Input
            maxLength={200}
            onChange={(event) => {
              setBeneficiaryMessageTemplate(event.target.value);
            }}
            placeholder={t("qrBeneficiaryDefault", {
              number: "{number}",
              client: "{client}",
            })}
            value={beneficiaryMessageTemplate}
          />
          <p className="text-muted-foreground text-xs">
            {t("qrBeneficiaryHint")}
          </p>
        </FieldGroup>
        <FieldGroup label={t("qrPayerNote")}>
          <Input
            maxLength={200}
            onChange={(event) => {
              setPayerNoteTemplate(event.target.value);
            }}
            placeholder={t("qrPayerDefault", {
              number: "{number}",
              issuer: "{issuer}",
            })}
            value={payerNoteTemplate}
          />
          <p className="text-muted-foreground text-xs">{t("qrPayerHint")}</p>
        </FieldGroup>
        <p className="text-muted-foreground text-xs">
          {t("qrTemplateVariables", {
            number: "{number}",
            issuer: "{issuer}",
            client: "{client}",
          })}
        </p>
      </section>
      <SubmitRow pending={pending} />
    </form>
  );
}
