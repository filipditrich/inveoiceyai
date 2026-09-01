import * as React from "react";
import { Button, Text } from "@react-email/components";

import { invoiceEmailCopy, type EmailLocale } from "../copy";

export type InvoiceSummaryProps = {
  number: string;
  issueDate: string;
  dueDate: string;
  totalLabel: string;
  clientName: string;
  issuerName: string;
  invoiceUrl?: string;
  locale?: EmailLocale;
};

export function InvoiceSummary(props: InvoiceSummaryProps) {
  const copy = invoiceEmailCopy(props.locale ?? "cs");
  return (
    <>
      <Text style={row}>
        <strong>{copy.number}:</strong> {props.number}
      </Text>
      <Text style={row}>
        <strong>{copy.customer}:</strong> {props.clientName}
      </Text>
      <Text style={row}>
        <strong>{copy.supplier}:</strong> {props.issuerName}
      </Text>
      <Text style={row}>
        <strong>{copy.issued}:</strong> {props.issueDate}
      </Text>
      <Text style={row}>
        <strong>{copy.due}:</strong> {props.dueDate}
      </Text>
      <Text style={row}>
        <strong>{copy.total}:</strong> {props.totalLabel}
      </Text>
      {props.invoiceUrl ? (
        <Button href={props.invoiceUrl} style={button}>
          {copy.openInvoice}
        </Button>
      ) : null}
    </>
  );
}

const row: React.CSSProperties = {
  color: "#222222",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0 0 6px",
};

const button: React.CSSProperties = {
  backgroundColor: "#111111",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  marginTop: "16px",
  padding: "10px 16px",
  textDecoration: "none",
};
