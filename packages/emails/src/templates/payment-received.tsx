import { Text } from "@react-email/components";
import * as React from "react";

import { invoiceEmailCopy, type EmailLocale } from "../copy";
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
  locale?: EmailLocale;
};

export function PaymentReceivedEmail(props: PaymentReceivedEmailProps) {
  const locale = props.locale ?? "cs";
  const copy = invoiceEmailCopy(locale);
  const title = copy.paidTitle(props.number);

  return (
    <EmailShell
      locale={locale}
      preview={copy.paidPreview(props.number)}
      title={title}
      variant="invoice"
    >
      <Text style={bodyText}>
        {copy.paidBody(props.number, props.issuerName)}
      </Text>
      <InvoiceSummary {...props} locale={locale} />
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
