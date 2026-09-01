import * as React from "react";
import { Button, Section, Text } from "@react-email/components";

import { EmailShell } from "../components/email-shell";
import type { EmailLocale } from "../copy";

export type BankPaymentAutoMatchedEmailProps = {
  userName: string;
  invoiceNumber: string;
  clientName: string;
  amountLabel: string;
  bookedDate: string;
  variableSymbol?: string | null;
  invoiceUrl: string;
  paymentsUrl: string;
  locale?: EmailLocale;
};

export function BankPaymentAutoMatchedEmail(
  props: BankPaymentAutoMatchedEmailProps,
) {
  const locale = props.locale ?? "cs";
  const cs = locale === "cs";
  const title = cs
    ? `Platba spárována — ${props.invoiceNumber}`
    : `Payment matched — ${props.invoiceNumber}`;

  return (
    <EmailShell
      footerLink={{
        href: props.paymentsUrl,
        label: cs ? "Otevřít přehled plateb" : "Open payments",
      }}
      locale={locale}
      preview={
        cs
          ? `Invoicey automaticky spárovalo ${props.amountLabel} s fakturou ${props.invoiceNumber}`
          : `Invoicey automatically matched ${props.amountLabel} to invoice ${props.invoiceNumber}`
      }
      title={title}
      variant="system"
    >
      <Text style={bodyText}>
        {cs
          ? `Ahoj${props.userName.trim() ? ` ${props.userName.trim()}` : ""}, příchozí platba přesně odpovídala faktuře a Invoicey ji označilo jako zaplacenou.`
          : `Hi${props.userName.trim() ? ` ${props.userName.trim()}` : ""}, an incoming payment exactly matched an invoice and Invoicey marked it as paid.`}
      </Text>
      <Section style={summaryBox}>
        <Text style={summaryLine}>
          <strong>{cs ? "Faktura" : "Invoice"}:</strong> {props.invoiceNumber}
        </Text>
        <Text style={summaryLine}>
          <strong>{cs ? "Odběratel" : "Client"}:</strong> {props.clientName}
        </Text>
        <Text style={summaryLine}>
          <strong>{cs ? "Částka" : "Amount"}:</strong> {props.amountLabel}
        </Text>
        <Text style={summaryLine}>
          <strong>{cs ? "Připsáno" : "Received"}:</strong> {props.bookedDate}
        </Text>
        <Text style={summaryLineLast}>
          <strong>{cs ? "Variabilní symbol" : "Variable symbol"}:</strong>{" "}
          {props.variableSymbol ?? "—"}
        </Text>
      </Section>
      <Button href={props.invoiceUrl} style={button}>
        {cs ? "Zkontrolovat fakturu" : "Review invoice"}
      </Button>
      <Text style={noteText}>
        {cs
          ? "Automatické párování lze kdykoli vypnout v nastavení bankovního připojení. Nejednoznačné ani částečné platby Invoicey nepotvrzuje automaticky."
          : "You can turn automatic matching off at any time in bank connection settings. Invoicey never auto-confirms ambiguous or partial payments."}
      </Text>
    </EmailShell>
  );
}

const bodyText: React.CSSProperties = {
  color: "#222222",
  fontSize: "14px",
  lineHeight: "1.55",
  margin: "0 0 16px",
};

const summaryBox: React.CSSProperties = {
  backgroundColor: "#f6f6f4",
  border: "1px solid #e8e8e4",
  borderRadius: "8px",
  margin: "0 0 20px",
  padding: "14px 16px",
};

const summaryLine: React.CSSProperties = {
  color: "#333333",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 6px",
};

const summaryLineLast: React.CSSProperties = {
  ...summaryLine,
  margin: 0,
};

const button: React.CSSProperties = {
  backgroundColor: "#e99a6c",
  borderRadius: "7px",
  color: "#1d1511",
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

export default BankPaymentAutoMatchedEmail;
