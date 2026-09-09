import * as React from "react";
import { Button, Section, Text } from "@react-email/components";

import { EmailShell } from "../components/email-shell";
import type { EmailLocale } from "../copy";

export type PaymentRequestSettledEmailProps = {
  userName: string;
  amountLabel: string;
  bookedDate: string;
  variableSymbol: string;
  note?: string | null;
  requestUrl: string;
  paymentsUrl: string;
  locale?: EmailLocale;
};

export function PaymentRequestSettledEmail(
  props: PaymentRequestSettledEmailProps,
) {
  const locale = props.locale ?? "cs";
  const cs = locale === "cs";
  const title = cs ? "Platba dorazila" : "Payment received";

  return (
    <EmailShell
      footerLink={{
        href: props.paymentsUrl,
        label: cs ? "Otevřít přehled plateb" : "Open payments",
      }}
      locale={locale}
      preview={
        cs
          ? `Invoicey potvrdilo ${props.amountLabel} na výzvu k platbě`
          : `Invoicey confirmed ${props.amountLabel} on a payment request`
      }
      title={title}
      variant="system"
    >
      <Text style={bodyText}>
        {cs
          ? `Ahoj${props.userName.trim() ? ` ${props.userName.trim()}` : ""}, požadovaná platba dorazila a Invoicey ji potvrdilo.`
          : `Hi${props.userName.trim() ? ` ${props.userName.trim()}` : ""}, the requested payment arrived and Invoicey confirmed it.`}
      </Text>
      <Section style={summaryBox}>
        <Text style={summaryLine}>
          <strong>{cs ? "Částka" : "Amount"}:</strong> {props.amountLabel}
        </Text>
        <Text style={summaryLine}>
          <strong>{cs ? "Připsáno" : "Received"}:</strong> {props.bookedDate}
        </Text>
        <Text style={summaryLine}>
          <strong>{cs ? "Variabilní symbol" : "Variable symbol"}:</strong>{" "}
          {props.variableSymbol}
        </Text>
        <Text style={summaryLineLast}>
          <strong>{cs ? "Poznámka" : "Note"}:</strong> {props.note ?? "—"}
        </Text>
      </Section>
      <Button href={props.requestUrl} style={button}>
        {cs ? "Otevřít výzvu" : "Open request"}
      </Button>
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
  backgroundColor: "#f4f4f5",
  border: "1px solid #e4e4e7",
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

export default PaymentRequestSettledEmail;
