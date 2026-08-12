import { Button, Text } from "@react-email/components";
import * as React from "react";

import { systemEmailCopy, type EmailLocale } from "../copy";
import { EmailShell } from "../components/email-shell";

export type NewSignInEmailProps = {
  userName: string;
  ipAddress: string | null;
  userAgent: string | null;
  signedInAt: string;
  trustUrl: string;
  securitySettingsUrl: string;
  locale?: EmailLocale;
};

export function NewSignInEmail(props: NewSignInEmailProps) {
  const locale = props.locale ?? "cs";
  const copy = systemEmailCopy(locale);
  const unknownBrowser = locale === "en" ? "unknown" : "neznámý";

  return (
    <EmailShell
      locale={locale}
      preview={copy.signInPreview}
      title={copy.signInTitle}
      variant="system"
      footerLink={{
        label: copy.securitySettings,
        href: props.securitySettingsUrl,
      }}
    >
      <Text style={bodyText}>{copy.signInHello(props.userName)}</Text>
      <Text style={bodyText}>
        <strong>{copy.signInTime}:</strong> {props.signedInAt}
        <br />
        <strong>{copy.signInIp}:</strong>{" "}
        {props.ipAddress?.trim() || copy.unknown}
        <br />
        <strong>{copy.signInBrowser}:</strong>{" "}
        {props.userAgent?.trim() || unknownBrowser}
      </Text>
      <Text style={bodyText}>{copy.signInTrustLead}</Text>
      <Button href={props.trustUrl} style={button}>
        {copy.signInTrust}
      </Button>
      <Text style={muted}>
        <a href={props.securitySettingsUrl} style={link}>
          {copy.securitySettings}
        </a>
      </Text>
    </EmailShell>
  );
}

const bodyText: React.CSSProperties = {
  color: "#222222",
  fontSize: "14px",
  lineHeight: "1.55",
  margin: "0 0 12px",
};

const muted: React.CSSProperties = {
  color: "#666666",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "16px 0 0",
};

const link: React.CSSProperties = {
  color: "#111111",
};

const button: React.CSSProperties = {
  backgroundColor: "#111111",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  padding: "10px 16px",
  textDecoration: "none",
};

export default NewSignInEmail;
