import * as React from "react";
import { Button, Section, Text } from "@react-email/components";

import { EmailShell } from "../components/email-shell";
import type { EmailLocale } from "../copy";

export type BankSyncFailedEmailProps = {
  userName: string;
  /** Display label for the bank, e.g. "Fio banka". */
  providerLabel: string;
  /** Masked or full account identifier shown for recognition. */
  accountLabel: string;
  /** Already-localized explanation of the error code. */
  reasonLabel: string;
  /** Consecutive failed attempts, so the reader can judge urgency. */
  failureCount: number;
  lastSuccessLabel: string | null;
  connectionsUrl: string;
  locale?: EmailLocale;
};

/**
 * A Fio monitoring token is valid for at most 180 days. When it lapses, sync
 * fails silently forever and payment matching just stops — the workspace keeps
 * issuing invoices and never learns they are being paid. This is the only
 * signal that failure ever reaches a human.
 */
export function BankSyncFailedEmail(props: BankSyncFailedEmailProps) {
  const locale = props.locale ?? "cs";
  const cs = locale === "cs";
  const name = props.userName.trim();

  return (
    <EmailShell
      footerLink={{
        href: props.connectionsUrl,
        label: cs ? "Otevřít bankovní připojení" : "Open bank connections",
      }}
      locale={locale}
      preview={
        cs
          ? `Invoicey se nedaří stáhnout pohyby z účtu ${props.accountLabel}`
          : `Invoicey cannot read transactions from ${props.accountLabel}`
      }
      title={
        cs
          ? "Bankovní připojení nefunguje"
          : "Your bank connection has stopped working"
      }
      variant="system"
    >
      <Text style={bodyText}>
        {cs
          ? `Ahoj${name ? ` ${name}` : ""}, Invoicey se opakovaně nedaří načíst pohyby z připojeného účtu. Dokud to trvá, příchozí platby se nespárují a faktury zůstanou označené jako nezaplacené.`
          : `Hi${name ? ` ${name}` : ""}, Invoicey has repeatedly failed to read transactions from your connected account. Until this is fixed, incoming payments will not be matched and invoices will stay marked unpaid.`}
      </Text>
      <Section style={summaryBox}>
        <Text style={summaryLine}>
          <strong>{cs ? "Banka" : "Bank"}:</strong> {props.providerLabel}
        </Text>
        <Text style={summaryLine}>
          <strong>{cs ? "Účet" : "Account"}:</strong> {props.accountLabel}
        </Text>
        <Text style={summaryLine}>
          <strong>{cs ? "Důvod" : "Reason"}:</strong> {props.reasonLabel}
        </Text>
        <Text style={summaryLine}>
          <strong>{cs ? "Neúspěšných pokusů" : "Failed attempts"}:</strong>{" "}
          {props.failureCount}
        </Text>
        <Text style={summaryLineLast}>
          <strong>{cs ? "Poslední úspěch" : "Last success"}:</strong>{" "}
          {props.lastSuccessLabel ?? (cs ? "nikdy" : "never")}
        </Text>
      </Section>
      <Button href={props.connectionsUrl} style={button}>
        {cs ? "Obnovit připojení" : "Fix the connection"}
      </Button>
      <Text style={noteText}>
        {cs
          ? "Nejčastější příčina je vypršený token pro sledování účtu. Vygenerujte v internetovém bankovnictví nový a vložte ho v nastavení — historie plateb zůstane zachovaná."
          : "The usual cause is an expired account-monitoring token. Generate a new one in your internet banking and paste it in settings — your payment history is preserved."}
      </Text>
    </EmailShell>
  );
}

const bodyText: React.CSSProperties = {
  color: "#27272a",
  fontSize: "14px",
  lineHeight: "1.55",
  margin: "0 0 16px",
};

const summaryBox: React.CSSProperties = {
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "8px",
  margin: "0 0 20px",
  padding: "14px 16px",
};

const summaryLine: React.CSSProperties = {
  color: "#3f3f46",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 6px",
};

const summaryLineLast: React.CSSProperties = {
  ...summaryLine,
  margin: 0,
};

const button: React.CSSProperties = {
  backgroundColor: "#f97316",
  borderRadius: "7px",
  color: "#1c1917",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  padding: "10px 16px",
  textDecoration: "none",
};

const noteText: React.CSSProperties = {
  color: "#777777",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "18px 0 0",
};

export default BankSyncFailedEmail;
