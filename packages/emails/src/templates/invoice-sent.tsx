import { Text } from "@react-email/components";
import * as React from "react";

import { EmailShell } from "../components/email-shell";
import { InvoiceSummary } from "../components/invoice-summary";

export type InvoiceSentEmailProps = {
  coverText: string;
  number: string;
  issueDate: string;
  dueDate: string;
  totalLabel: string;
  clientName: string;
  issuerName: string;
  invoiceUrl?: string;
};

export function InvoiceSentEmail(props: InvoiceSentEmailProps) {
  const title = `Faktura ${props.number}`;
  const lines = props.coverText.split("\n");

  return (
    <EmailShell
      preview={`Faktura ${props.number} od ${props.issuerName}`}
      title={title}
      variant="invoice"
    >
      {lines.map((line, i) => (
        <Text key={i} style={bodyText}>
          {line.length === 0 ? "\u00a0" : line}
        </Text>
      ))}
      <InvoiceSummary
        number={props.number}
        issueDate={props.issueDate}
        dueDate={props.dueDate}
        totalLabel={props.totalLabel}
        clientName={props.clientName}
        issuerName={props.issuerName}
        invoiceUrl={props.invoiceUrl}
      />
    </EmailShell>
  );
}

const bodyText: React.CSSProperties = {
  color: "#222222",
  fontSize: "14px",
  lineHeight: "1.55",
  margin: "0 0 4px",
};

export default InvoiceSentEmail;
