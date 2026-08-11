"use client";

import { saveIssuerEmail } from "@/actions/issuers";
import {
  FieldGroup,
  lookupMessageFromInvalid,
  SubmitRow,
} from "@/components/issuers/issuer-form-shared";
import { Input } from "@/components/ui/input";
import type { IssuerEmailSettings } from "@invoicey/db";
import type { FormEvent } from "react";
import * as React from "react";

export function IssuerEmailForm(props: {
  issuerId: string;
  emailSettings: IssuerEmailSettings | null;
  invalidQuery?: string | null;
}) {
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
  const userMsg = lookupMessageFromInvalid(props.invalidQuery);

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
      {userMsg ? <p className="text-destructive text-sm">{userMsg}</p> : null}
      <FieldGroup label="Předmět šablona">
        <Input
          onChange={(ev) => {
            setEmailSubject(ev.target.value);
          }}
          value={emailSubject}
        />
      </FieldGroup>
      <FieldGroup label="Text zprávy">
        <textarea
          className="border-input bg-background min-h-28 w-full rounded-md border px-3 py-2 text-sm"
          onChange={(ev) => {
            setEmailCover(ev.target.value);
          }}
          value={emailCover}
        />
      </FieldGroup>
      <FieldGroup label="From display šablona">
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
        Přikládat ISDOC ve výchozím stavu
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          checked={emailOverdue}
          onChange={(ev) => {
            setEmailOverdue(ev.target.checked);
          }}
          type="checkbox"
        />
        Posílat připomínky po splatnosti
      </label>
      {emailOverdue ? (
        <FieldGroup label="Interval připomínek (dny)">
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
        Posílat potvrzení o přijetí platby
      </label>
      <SubmitRow pending={pending} />
    </form>
  );
}
