import { Text } from "@react-email/components";
import * as React from "react";

import { EmailShell } from "../components/email-shell";
import { InvoiceSummary } from "../components/invoice-summary";

export type PaymentReceivedEmailProps = {
  number: string;
  issueDate: string;
  dueDate: string;
  totalLabel: string;
  clientName: string;
  issuerName: string;
  invoiceUrl?: string;
};

export function PaymentReceivedEmail(props: PaymentReceivedEmailProps) {
  const title = `Platba přijata — ${props.number}`;

  return (
    <EmailShell
      preview={`Platba za fakturu ${props.number} byla zaznamenána`}
      title={title}
      variant="invoice"
    >
      <Text style={bodyText}>
        Dobrý den, potvrzujeme přijetí platby za fakturu{" "}
        <strong>{props.number}</strong> od {props.issuerName}.
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

export default PaymentReceivedEmail;
