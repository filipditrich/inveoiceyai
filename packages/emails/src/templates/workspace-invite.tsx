import { Button, Text } from "@react-email/components";
import * as React from "react";

import { systemEmailCopy, type EmailLocale } from "../copy";
import { EmailShell } from "../components/email-shell";

export type WorkspaceInviteEmailProps = {
  workspaceName: string;
  inviterName: string;
  inviteUrl: string;
  role: string;
  expiresAtLabel?: string | null;
  locale?: EmailLocale;
};

function roleLabel(role: string, locale: EmailLocale): string {
  const copy = systemEmailCopy(locale);
  switch (role) {
    case "admin":
      return copy.roleAdmin;
    case "owner":
      return copy.roleOwner;
    case "member":
      return copy.roleMember;
    default:
      return role;
  }
}

export function WorkspaceInviteEmail(props: WorkspaceInviteEmailProps) {
  const locale = props.locale ?? "cs";
  const copy = systemEmailCopy(locale);
  const title = copy.inviteTitle(props.workspaceName);
  const role = roleLabel(props.role, locale);

  return (
    <EmailShell
      locale={locale}
      preview={copy.invitePreview(props.inviterName, props.workspaceName)}
      title={title}
      variant="system"
    >
      <Text style={bodyText}>
        {copy.inviteBody1(props.inviterName, props.workspaceName, role)}
      </Text>
      <Text style={bodyText}>{copy.inviteBody2}</Text>
      {props.expiresAtLabel ? (
        <Text style={bodyText}>{copy.inviteExpiry(props.expiresAtLabel)}</Text>
      ) : null}
      <Text style={bodyText}>{copy.inviteCtaLead}</Text>
      <Button href={props.inviteUrl} style={button}>
        {copy.inviteAccept}
      </Button>
      <Text style={muted}>
        {copy.inviteLinkFallback}
        <br />
        {props.inviteUrl}
      </Text>
      <Text style={muted}>{copy.inviteIgnore}</Text>
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
  wordBreak: "break-all",
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

export default WorkspaceInviteEmail;
