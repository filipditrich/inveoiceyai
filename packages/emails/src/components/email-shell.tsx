import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { EmailLocale } from "../copy";
import { invoiceEmailCopy, systemEmailCopy } from "../copy";

const DEFAULT_APP_ORIGIN = "https://invoicey.ditrich.me";

export type EmailShellVariant = "invoice" | "system";

export type EmailShellProps = {
  preview: string;
  title: string;
  children: React.ReactNode;
  variant?: EmailShellVariant;
  locale?: EmailLocale;
  /** absolute origin for logo asset; defaults to production host */
  appOrigin?: string;
  footerLink?: { label: string; href: string };
};

function defaultFooterNote(
  variant: EmailShellVariant,
  locale: EmailLocale,
): string {
  switch (variant) {
    case "invoice":
      return invoiceEmailCopy(locale).footerInvoice;
    case "system":
      return systemEmailCopy(locale).footerSystem;
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

/** Shared transactional email chrome. */
export function EmailShell({
  preview,
  title,
  children,
  variant = "system",
  locale = "cs",
  appOrigin = DEFAULT_APP_ORIGIN,
  footerLink,
}: EmailShellProps) {
  const origin = appOrigin.replace(/\/$/, "");
  const logoSrc = `${origin}/brand/invoicey-logo-192.png`;

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brandRow}>
            <Link href={origin} style={brandLink}>
              <Img
                src={logoSrc}
                width={36}
                height={36}
                alt="Invoicey"
                style={logo}
              />
            </Link>
          </Section>
          <Heading style={heading}>{title}</Heading>
          <Section>{children}</Section>
          <Hr style={hr} />
          <Text style={footerNoteStyle}>
            {defaultFooterNote(variant, locale)}
          </Text>
          <Text style={footer}>
            Invoicey ·{" "}
            <Link href={origin} style={footerLinkStyle}>
              invoicey.ditrich.me
            </Link>
          </Text>
          {footerLink ? (
            <Text style={footer}>
              <Link href={footerLink.href} style={footerLinkStyle}>
                {footerLink.label}
              </Link>
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#f6f6f4",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  margin: 0,
  padding: "24px 12px",
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "28px 24px",
};

const brandRow: React.CSSProperties = {
  margin: "0 0 16px",
};

const brandLink: React.CSSProperties = {
  display: "inline-block",
  lineHeight: 0,
  textDecoration: "none",
};

const logo: React.CSSProperties = {
  borderRadius: "8px",
  display: "block",
};

const heading: React.CSSProperties = {
  color: "#111111",
  fontSize: "22px",
  fontWeight: 600,
  lineHeight: "1.3",
  margin: "0 0 16px",
};

const hr: React.CSSProperties = {
  borderColor: "#e8e8e4",
  borderTop: "1px solid #e8e8e4",
  margin: "24px 0 12px",
};

const footerNoteStyle: React.CSSProperties = {
  color: "#888888",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 6px",
};

const footer: React.CSSProperties = {
  color: "#888888",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 4px",
};

const footerLinkStyle: React.CSSProperties = {
  color: "#666666",
  textDecoration: "underline",
};
