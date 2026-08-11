import { Button, Text } from "@react-email/components";
import * as React from "react";

export type InvoiceSummaryProps = {
  number: string;
  issueDate: string;
  dueDate: string;
  totalLabel: string;
  clientName: string;
  issuerName: string;
  invoiceUrl?: string;
};

export function InvoiceSummary(props: InvoiceSummaryProps) {
  return (
    <>
      <Text style={row}>
        <strong>Číslo:</strong> {props.number}
      </Text>
      <Text style={row}>
        <strong>Odběratel:</strong> {props.clientName}
      </Text>
      <Text style={row}>
        <strong>Dodavatel:</strong> {props.issuerName}
      </Text>
      <Text style={row}>
        <strong>Vystaveno:</strong> {props.issueDate}
      </Text>
      <Text style={row}>
        <strong>Splatnost:</strong> {props.dueDate}
      </Text>
      <Text style={row}>
        <strong>Celkem:</strong> {props.totalLabel}
      </Text>
      {props.invoiceUrl ? (
        <Button href={props.invoiceUrl} style={button}>
          Otevřít fakturu
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
