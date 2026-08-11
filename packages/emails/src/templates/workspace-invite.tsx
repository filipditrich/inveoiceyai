import { Button, Text } from "@react-email/components";
import * as React from "react";

import { EmailShell } from "../components/email-shell";

export type WorkspaceInviteEmailProps = {
  workspaceName: string;
  inviterName: string;
  inviteUrl: string;
  role: string;
};

export function WorkspaceInviteEmail(props: WorkspaceInviteEmailProps) {
  const title = `Pozvánka do ${props.workspaceName}`;

  return (
    <EmailShell
      preview={`${props.inviterName} vás zve do workspace ${props.workspaceName}`}
      title={title}
    >
      <Text style={bodyText}>
        {props.inviterName} vás zve do workspace{" "}
        <strong>{props.workspaceName}</strong> jako {props.role}.
      </Text>
      <Text style={bodyText}>Kliknutím na tlačítko pozvánku přijmete:</Text>
      <Button href={props.inviteUrl} style={button}>
        Přijmout pozvánku
      </Button>
      <Text style={muted}>Nebo otevřete odkaz: {props.inviteUrl}</Text>
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
