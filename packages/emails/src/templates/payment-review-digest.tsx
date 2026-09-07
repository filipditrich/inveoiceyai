import * as React from "react";
import { Button, Section, Text } from "@react-email/components";

import { EmailShell } from "../components/email-shell";
import type { EmailLocale } from "../copy";

export type PaymentReviewProposal = {
  invoiceNumber: string;
  clientName: string;
  amountLabel: string;
  bookedDate: string;
  variableSymbol?: string | null;
  /** Already-localized match strength, e.g. "Strong match". */
  confidenceLabel: string;
  /** Already-localized blocker sentences; empty when nothing blocks. */
  blockerLabels?: readonly string[];
};

export type PaymentReviewUnmatched = {
  amountLabel: string;
  bookedDate: string;
  counterpartyName?: string | null;
  variableSymbol?: string | null;
};

export type PaymentReviewDigestEmailProps = {
  userName: string;
  proposals: readonly PaymentReviewProposal[];
  unmatched: readonly PaymentReviewUnmatched[];
  paymentsUrl: string;
  locale?: EmailLocale;
};

/**
 * The counterpart to `bank-payment-auto-matched`: that one reports work already
 * done, this one reports work waiting. Auto-confirm is off by default and only
 * ever fires on a flawless match, so without this digest the common case — a
 * payment that needs one human glance — is silent.
 */
export function PaymentReviewDigestEmail(props: PaymentReviewDigestEmailProps) {
  const locale = props.locale ?? "cs";
  const cs = locale === "cs";
  const name = props.userName.trim();
  const proposalCount = props.proposals.length;
  const unmatchedCount = props.unmatched.length;

  const title = cs
    ? proposalCount > 0
      ? `Nové platby ke kontrole (${proposalCount})`
      : `Nespárované platby (${unmatchedCount})`
    : proposalCount > 0
      ? `Payments to review (${proposalCount})`
      : `Unmatched payments (${unmatchedCount})`;

  return (
    <EmailShell
      footerLink={{
        href: props.paymentsUrl,
        label: cs ? "Otevřít přehled plateb" : "Open payments",
      }}
      locale={locale}
      preview={
        cs
          ? `Invoicey našlo ${proposalCount + unmatchedCount} příchozích plateb, které čekají na vás`
          : `Invoicey found ${proposalCount + unmatchedCount} incoming payments waiting on you`
      }
      title={title}
      variant="system"
    >
      <Text style={bodyText}>
        {cs
          ? `Ahoj${name ? ` ${name}` : ""}, banka připsala platby, které Invoicey samo nepotvrdilo. Potvrzení je vždy na vás.`
          : `Hi${name ? ` ${name}` : ""}, your bank credited payments that Invoicey did not confirm on its own. Confirming is always your call.`}
      </Text>

      {proposalCount > 0 ? (
        <>
          <Text style={sectionHeading}>
            {cs ? "Čeká na potvrzení" : "Waiting for confirmation"}
          </Text>
          {props.proposals.map((proposal, index) => (
            <Section key={`proposal-${index}`} style={summaryBox}>
              <Text style={summaryTitle}>
                {proposal.amountLabel} → {proposal.invoiceNumber}
              </Text>
              <Text style={summaryLine}>
                <strong>{cs ? "Odběratel" : "Client"}:</strong>{" "}
                {proposal.clientName}
              </Text>
              <Text style={summaryLine}>
                <strong>{cs ? "Připsáno" : "Received"}:</strong>{" "}
                {proposal.bookedDate}
                {" · "}
                <strong>{cs ? "VS" : "VS"}:</strong>{" "}
                {proposal.variableSymbol ?? "—"}
              </Text>
              <Text
                style={
                  proposal.blockerLabels?.length ? summaryLine : summaryLineLast
                }
              >
                <strong>{cs ? "Shoda" : "Match"}:</strong>{" "}
                {proposal.confidenceLabel}
              </Text>
              {proposal.blockerLabels?.length ? (
                <Text style={blockerLine}>
                  {proposal.blockerLabels.join(" · ")}
                </Text>
              ) : null}
            </Section>
          ))}
        </>
      ) : null}

      {unmatchedCount > 0 ? (
        <>
          <Text style={sectionHeading}>
            {cs
              ? "Bez návrhu — žádná faktura nesedí"
              : "No proposal — nothing matched"}
          </Text>
          {props.unmatched.map((transaction, index) => (
            <Section key={`unmatched-${index}`} style={summaryBox}>
              <Text style={summaryTitle}>{transaction.amountLabel}</Text>
              <Text style={summaryLine}>
                <strong>{cs ? "Od" : "From"}:</strong>{" "}
                {transaction.counterpartyName ??
                  (cs ? "Neznámý odesílatel" : "Unknown sender")}
              </Text>
              <Text style={summaryLineLast}>
                <strong>{cs ? "Připsáno" : "Received"}:</strong>{" "}
                {transaction.bookedDate}
                {" · "}
                <strong>VS:</strong> {transaction.variableSymbol ?? "—"}
              </Text>
            </Section>
          ))}
          <Text style={noteText}>
            {cs
              ? "Tyto platby lze na faktuře přiřadit ručně — obvykle jde o chybný variabilní symbol nebo jinou částku."
              : "You can allocate these by hand — usually the variable symbol is wrong or the amount differs."}
          </Text>
        </>
      ) : null}

      <Button href={props.paymentsUrl} style={button}>
        {cs ? "Zkontrolovat platby" : "Review payments"}
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

const sectionHeading: React.CSSProperties = {
  color: "#18181b",
  fontSize: "13px",
  fontWeight: 600,
  letterSpacing: "0.02em",
  margin: "20px 0 10px",
  textTransform: "uppercase",
};

const summaryBox: React.CSSProperties = {
  backgroundColor: "#f4f4f5",
  border: "1px solid #e4e4e7",
  borderRadius: "8px",
  margin: "0 0 10px",
  padding: "14px 16px",
};

const summaryTitle: React.CSSProperties = {
  color: "#18181b",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: "1.5",
  margin: "0 0 8px",
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

const blockerLine: React.CSSProperties = {
  color: "#b91c1c",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "6px 0 0",
};

const button: React.CSSProperties = {
  backgroundColor: "#f97316",
  borderRadius: "7px",
  color: "#1c1917",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  margin: "20px 0 0",
  padding: "10px 16px",
  textDecoration: "none",
};

const noteText: React.CSSProperties = {
  color: "#777777",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "10px 0 0",
};

export default PaymentReviewDigestEmail;
