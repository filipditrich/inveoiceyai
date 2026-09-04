import * as React from "react";
import { Button, Link, Text } from "@react-email/components";

import { EmailShell } from "../components/email-shell";
import { InvoiceSummary } from "../components/invoice-summary";
import { invoiceEmailCopy, type EmailLocale } from "../copy";

export type GuestInvoiceEmailProps = {
  number: string;
  issueDate: string;
  dueDate: string;
  totalLabel: string;
  clientName: string;
  issuerName: string;
  claimUrl: string;
  downloadUrl: string;
  locale?: EmailLocale;
};

export function GuestInvoiceEmail(props: GuestInvoiceEmailProps) {
  const locale = props.locale ?? "cs";
  const copy = invoiceEmailCopy(locale);
  const title = copy.guestTitle(props.number);

  return (
    <EmailShell
      locale={locale}
      preview={copy.guestPreview(props.number)}
      title={title}
      variant="invoice"
    >
      <Text style={bodyText}>{copy.guestIntro(props.number)}</Text>
      <Text style={bodyText}>{copy.guestKept}</Text>
      <InvoiceSummary
        locale={locale}
        number={props.number}
        issueDate={props.issueDate}
        dueDate={props.dueDate}
        totalLabel={props.totalLabel}
        clientName={props.clientName}
        issuerName={props.issuerName}
      />
      <Button href={props.claimUrl} style={claimButton}>
        {copy.guestClaimCta}
      </Button>
      <Text style={downloadText}>
        {copy.guestDownloadLead}{" "}
        <Link href={props.downloadUrl} style={downloadLink}>
          {copy.guestDownloadLinkLabel}
        </Link>
      </Text>
    </EmailShell>
  );
}

const bodyText: React.CSSProperties = {
  color: "#222222",
  fontSize: "14px",
  lineHeight: "1.55",
  margin: "0 0 4px",
};

const claimButton: React.CSSProperties = {
  backgroundColor: "#f97316",
  borderRadius: "6px",
  color: "#1c1917",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  marginTop: "20px",
  padding: "10px 16px",
  textDecoration: "none",
};

const downloadText: React.CSSProperties = {
  color: "#52525b",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "16px 0 0",
};

const downloadLink: React.CSSProperties = {
  color: "#52525b",
  textDecoration: "underline",
};

export default GuestInvoiceEmail;
