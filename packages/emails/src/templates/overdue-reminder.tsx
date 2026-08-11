import { Text } from "@react-email/components";
import * as React from "react";

import { EmailShell } from "../components/email-shell";
import { InvoiceSummary } from "../components/invoice-summary";

export type OverdueReminderEmailProps = {
  number: string;
  issueDate: string;
  dueDate: string;
  totalLabel: string;
  clientName: string;
  issuerName: string;
  invoiceUrl?: string;
};

export function OverdueReminderEmail(props: OverdueReminderEmailProps) {
  const title = `Připomínka: faktura ${props.number}`;

  return (
    <EmailShell
      preview={`Faktura ${props.number} je po splatnosti`}
      title={title}
    >
      <Text style={bodyText}>
        Dobrý den, dovolujeme si připomenout, že faktura{" "}
        <strong>{props.number}</strong> od {props.issuerName} je po splatnosti (
        {props.dueDate}).
      </Text>
      <InvoiceSummary {...props} />
    </EmailShell>
  );
}

const bodyText: React.CSSProperties = {
  color: "#222222",
  fontSize: "14px",
  lineHeight: "1.55",
  margin: "0 0 16px",
};

export default OverdueReminderEmail;
