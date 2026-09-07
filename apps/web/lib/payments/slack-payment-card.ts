import {
  INVOICEY_ACTIONS,
  encodePaymentValue,
} from "@/agent/lib/slack-invoice-actions";
import {
  Actions,
  Button,
  Card,
  CardText,
  Field,
  Fields,
  LinkButton,
  type CardElement,
} from "eve/channels/slack";

import type { EmailLocale } from "@invoicey/emails";

export type SlackPaymentProposal = {
  proposalId: string;
  /** Deep link to the invoice, resolved by the caller that owns the origin. */
  invoiceUrl: string;
  invoiceNumber: string;
  clientName: string;
  amountLabel: string;
  proposedAmountLabel: string;
  bookedDateLabel: string;
  variableSymbol: string | null;
  counterpartyName: string | null;
  confidenceLabel: string;
  blockerLabels: readonly string[];
};

export type SlackPaymentUnmatched = {
  amountLabel: string;
  bookedDateLabel: string;
  counterpartyName: string | null;
  variableSymbol: string | null;
};

type Copy = {
  proposalTitle: (amount: string, invoice: string) => string;
  client: string;
  received: string;
  match: string;
  from: string;
  unknownSender: string;
  confirm: (amount: string) => string;
  reject: string;
  openWeb: string;
  unmatchedTitle: (count: number) => string;
  unmatchedHint: string;
};

const COPY = {
  cs: {
    proposalTitle: (amount, invoice) => `${amount} → ${invoice}`,
    client: "Odběratel",
    received: "Připsáno",
    match: "Shoda",
    from: "Od",
    unknownSender: "Neznámý odesílatel",
    confirm: (amount) => `Potvrdit ${amount}`,
    reject: "Není tato faktura",
    openWeb: "Otevřít v Invoicey",
    unmatchedTitle: (count) =>
      count === 1 ? "1 platba bez faktury" : `${count} plateb bez faktury`,
    unmatchedHint:
      "Žádná vystavená faktura těmto platbám neodpovídá — přiřaďte je ručně v Invoicey.",
  },
  en: {
    proposalTitle: (amount, invoice) => `${amount} → ${invoice}`,
    client: "Client",
    received: "Received",
    match: "Match",
    from: "From",
    unknownSender: "Unknown sender",
    confirm: (amount) => `Confirm ${amount}`,
    reject: "Not this invoice",
    openWeb: "Open in Invoicey",
    unmatchedTitle: (count) =>
      count === 1 ? "1 unmatched payment" : `${count} unmatched payments`,
    unmatchedHint:
      "No issued invoice matches these — allocate them by hand in Invoicey.",
  },
} satisfies Record<EmailLocale, Copy>;

/**
 * One card per proposal, each carrying its own decision.
 *
 * Batching several proposals onto one card would force a single Confirm to
 * mean "all of them", which is exactly the unattended behaviour the matcher
 * refuses to do on its own. Separate cards keep every confirmation a specific
 * act of consent against a named invoice and amount — the same contract the
 * invoice cards already follow.
 */
export function buildPaymentProposalCard(input: {
  proposal: SlackPaymentProposal;
  locale: EmailLocale;
}): CardElement {
  const copy = COPY[input.locale];
  const proposal = input.proposal;
  const fields = [
    Field({ label: copy.client, value: proposal.clientName }),
    Field({ label: copy.received, value: proposal.bookedDateLabel }),
    Field({ label: "VS", value: proposal.variableSymbol ?? "—" }),
    Field({ label: copy.match, value: proposal.confidenceLabel }),
  ];
  if (proposal.counterpartyName) {
    fields.push(Field({ label: copy.from, value: proposal.counterpartyName }));
  }

  const children: CardElement["children"] = [
    Fields(fields),
    Actions([
      Button({
        id: INVOICEY_ACTIONS.paymentConfirm,
        label: copy.confirm(proposal.proposedAmountLabel),
        style: "primary",
        value: encodePaymentValue(proposal.proposalId),
      }),
      Button({
        id: INVOICEY_ACTIONS.paymentReject,
        label: copy.reject,
        value: encodePaymentValue(proposal.proposalId),
      }),
      LinkButton({
        id: INVOICEY_ACTIONS.openWeb,
        url: proposal.invoiceUrl,
        label: copy.openWeb,
      }),
    ]),
  ];
  if (proposal.blockerLabels.length > 0) {
    children.unshift(
      CardText(`:warning: ${proposal.blockerLabels.join(" · ")}`),
    );
  }

  return Card({
    title: copy.proposalTitle(proposal.amountLabel, proposal.invoiceNumber),
    subtitle: proposal.clientName,
    children,
  });
}

/**
 * Unmatched credits get one summary card, not one card each.
 *
 * There is no decision to offer: nothing matched, so the only useful action is
 * to open the ledger. A per-transaction card would be a wall of buttonless
 * noise in a DM.
 */
export function buildUnmatchedPaymentsCard(input: {
  unmatched: readonly SlackPaymentUnmatched[];
  paymentsUrl: string;
  locale: EmailLocale;
}): CardElement {
  const copy = COPY[input.locale];
  return Card({
    title: copy.unmatchedTitle(input.unmatched.length),
    subtitle: copy.unmatchedHint,
    children: [
      ...input.unmatched.map((transaction) =>
        Fields([
          Field({ label: "", value: `*${transaction.amountLabel}*` }),
          Field({
            label: copy.from,
            value: transaction.counterpartyName ?? copy.unknownSender,
          }),
          Field({ label: copy.received, value: transaction.bookedDateLabel }),
          Field({ label: "VS", value: transaction.variableSymbol ?? "—" }),
        ]),
      ),
      Actions([
        LinkButton({
          id: INVOICEY_ACTIONS.openWeb,
          url: input.paymentsUrl,
          label: copy.openWeb,
          style: "primary",
        }),
      ]),
    ],
  });
}
