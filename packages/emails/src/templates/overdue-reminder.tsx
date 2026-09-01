import * as React from "react";
import { Text } from "@react-email/components";

import { EmailShell } from "../components/email-shell";
import { InvoiceSummary } from "../components/invoice-summary";
import { invoiceEmailCopy, type EmailLocale } from "../copy";

export type OverdueReminderEmailProps = {
  number: string;
  issueDate: string;
  dueDate: string;
  totalLabel: string;
  clientName: string;
  issuerName: string;
  invoiceUrl?: string;
  locale?: EmailLocale;
};

export function OverdueReminderEmail(props: OverdueReminderEmailProps) {
  const locale = props.locale ?? "cs";
  const copy = invoiceEmailCopy(locale);
  const title = copy.overdueTitle(props.number);

  return (
    <EmailShell
      locale={locale}
      preview={copy.overduePreview(props.number)}
      title={title}
      variant="invoice"
    >
      <Text style={bodyText}>
        {copy.overdueBody(props.number, props.issuerName, props.dueDate)}
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

export default OverdueReminderEmail;
