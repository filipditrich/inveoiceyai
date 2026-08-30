import { Button, Text } from "@react-email/components";
import * as React from "react";

import { systemEmailCopy, type EmailLocale } from "../copy";
import { EmailShell } from "../components/email-shell";

export type TokenRewardEmailProps = {
  userName: string;
  /** Formatted for display ("500k"), not the raw count. */
  tokens: string;
  workspaceName: string;
  usageUrl: string;
  locale?: EmailLocale;
};

/**
 * The first-issued-invoice reward (ADR 0037). Sent once per workspace, keyed
 * off a real grant-ledger insert, so a retried issue cannot send it twice.
 */
export function TokenRewardEmail(props: TokenRewardEmailProps) {
  const locale = props.locale ?? "cs";
  const copy = systemEmailCopy(locale);

  return (
    <EmailShell
      locale={locale}
      preview={copy.tokenRewardPreview}
      title={copy.tokenRewardTitle}
      variant="system"
      footerLink={{ label: copy.tokenRewardCta, href: props.usageUrl }}
    >
      <Text style={bodyText}>{copy.tokenRewardHello(props.userName)}</Text>
      <Text style={bodyText}>
        {copy.tokenRewardBody(props.tokens, props.workspaceName)}
      </Text>
      <Button href={props.usageUrl} style={button}>
        {copy.tokenRewardCta}
      </Button>
    </EmailShell>
  );
}

const bodyText: React.CSSProperties = {
  color: "#222222",
  fontSize: "14px",
  lineHeight: "1.55",
  margin: "0 0 12px",
};

const button: React.CSSProperties = {
  backgroundColor: "#111111",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  padding: "10px 18px",
  textDecoration: "none",
};
