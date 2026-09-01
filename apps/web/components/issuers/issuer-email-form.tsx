"use client";

import type { FormEvent } from "react";
import * as React from "react";
import { saveIssuerEmail } from "@/actions/issuers";
import {
  FieldGroup,
  SubmitRow,
  useInvalidQueryMessage,
} from "@/components/issuers/issuer-form-shared";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";

import type { IssuerEmailSettings } from "@invoicey/db";

export function IssuerEmailForm(props: {
  issuerId: string;
  emailSettings: IssuerEmailSettings | null;
  invalidQuery?: string | null;
}) {
  const t = useTranslations("Issuers.emailForm");
  const emailSettings = props.emailSettings;
  const [pending, startTransition] = React.useTransition();
  const [emailSubject, setEmailSubject] = React.useState(
    emailSettings?.defaultSubject ?? "Faktura {number} — {issuerName}",
  );
  const [emailCover, setEmailCover] = React.useState(
    emailSettings?.defaultCoverText ??
      "Dobrý den,\n\nv příloze zasílám fakturu {number}.\n\nS pozdravem",
  );
  const [emailAttachIsdoc, setEmailAttachIsdoc] = React.useState(
    emailSettings?.attachIsdocByDefault !== false,
  );
  const [emailOverdue, setEmailOverdue] = React.useState(
    emailSettings?.overdueRemindersEnabled === true,
  );
  const [emailReminderDays, setEmailReminderDays] = React.useState(
    String(emailSettings?.overdueReminderIntervalDays ?? 7),
  );
  const [emailDisplayName, setEmailDisplayName] = React.useState(
    emailSettings?.displayNameTemplate ?? "{issuerName} via Invoicey",
  );
  const [emailPaymentReceived, setEmailPaymentReceived] = React.useState(
    emailSettings?.sendPaymentReceivedEmail === true,
  );
  const userMsg = useInvalidQueryMessage(props.invalidQuery);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("id", props.issuerId);
    fd.set("emailDefaultSubject", emailSubject);
    fd.set("emailDefaultCoverText", emailCover);
    fd.set("emailDisplayNameTemplate", emailDisplayName);
    fd.set("emailAttachIsdocByDefault", emailAttachIsdoc ? "true" : "false");
    fd.set("emailOverdueRemindersEnabled", emailOverdue ? "true" : "false");
    fd.set("emailOverdueReminderIntervalDays", emailReminderDays);
    fd.set(
      "emailSendPaymentReceivedEmail",
      emailPaymentReceived ? "true" : "false",
    );
    startTransition(async () => {
      await saveIssuerEmail(fd);
    });
  }

  return (
    <form className="max-w-2xl space-y-6" onSubmit={onSubmit}>
      {userMsg ? <p className="text-sm text-destructive">{userMsg}</p> : null}
      <FieldGroup label={t("subject")}>
        <Input
          onChange={(ev) => {
            setEmailSubject(ev.target.value);
          }}
          value={emailSubject}
        />
      </FieldGroup>
      <FieldGroup label={t("body")}>
        <textarea
          className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          onChange={(ev) => {
            setEmailCover(ev.target.value);
          }}
          value={emailCover}
        />
      </FieldGroup>
      <FieldGroup label={t("displayName")}>
        <Input
          onChange={(ev) => {
            setEmailDisplayName(ev.target.value);
          }}
          placeholder="{issuerName} via Invoicey"
          value={emailDisplayName}
        />
      </FieldGroup>
      <label className="flex items-center gap-2 text-sm">
        <input
          checked={emailAttachIsdoc}
          onChange={(ev) => {
            setEmailAttachIsdoc(ev.target.checked);
          }}
          type="checkbox"
        />
        {t("attachIsdoc")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          checked={emailOverdue}
          onChange={(ev) => {
            setEmailOverdue(ev.target.checked);
          }}
          type="checkbox"
        />
        {t("overdueReminders")}
      </label>
      {emailOverdue ? (
        <FieldGroup label={t("reminderInterval")}>
          <Input
            min={1}
            onChange={(ev) => {
              setEmailReminderDays(ev.target.value);
            }}
            type="number"
            value={emailReminderDays}
          />
        </FieldGroup>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input
          checked={emailPaymentReceived}
          onChange={(ev) => {
            setEmailPaymentReceived(ev.target.checked);
          }}
          type="checkbox"
        />
        {t("paymentReceived")}
      </label>
      <SubmitRow pending={pending} />
    </form>
  );
}
