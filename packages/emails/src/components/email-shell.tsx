import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export type EmailShellProps = {
  preview: string;
  title: string;
  children: React.ReactNode;
};

/** Shared transactional email chrome. */
export function EmailShell({ preview, title, children }: EmailShellProps) {
  return (
    <Html lang="cs">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>{title}</Heading>
          <Section>{children}</Section>
          <Hr style={hr} />
          <Text style={footer}>Invoicey · invoicey.ditrich.me</Text>
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

const footer: React.CSSProperties = {
  color: "#888888",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: 0,
};
