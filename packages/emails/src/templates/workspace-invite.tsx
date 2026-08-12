import { Button, Text } from "@react-email/components";
import * as React from "react";

import { EmailShell } from "../components/email-shell";

export type WorkspaceInviteEmailProps = {
  workspaceName: string;
  inviterName: string;
  inviteUrl: string;
  role: string;
  /** prague-local expiry label for czech copy */
  expiresAtLabel?: string | null;
};

function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "správce";
    case "owner":
      return "vlastník";
    case "member":
      return "člen";
    default:
      return role;
  }
}

export function WorkspaceInviteEmail(props: WorkspaceInviteEmailProps) {
  const title = `Pozvánka do ${props.workspaceName}`;
  const role = roleLabel(props.role);

  return (
    <EmailShell
      preview={`${props.inviterName} vás zve do workspace ${props.workspaceName}`}
      title={title}
      variant="system"
    >
      <Text style={bodyText}>
        Dobrý den, <strong>{props.inviterName}</strong> vás zve do pracovního
        prostoru <strong>{props.workspaceName}</strong> v Invoicey jako{" "}
        <strong>{role}</strong>.
      </Text>
      <Text style={bodyText}>
        Po přijetí uvidíte faktury, klienty a nastavení tohoto pracovního
        prostoru podle své role. Přihlaste se účtem se stejným e-mailem, na
        který přišla tato pozvánka.
      </Text>
      {props.expiresAtLabel ? (
        <Text style={bodyText}>
          Pozvánka platí do <strong>{props.expiresAtLabel}</strong> (časové
          pásmo Evropa/Praha).
        </Text>
      ) : null}
      <Text style={bodyText}>Kliknutím na tlačítko pozvánku otevřete:</Text>
      <Button href={props.inviteUrl} style={button}>
        Přijmout pozvánku
      </Button>
      <Text style={muted}>
        Pokud tlačítko nefunguje, otevřete odkaz v prohlížeči:
        <br />
        {props.inviteUrl}
      </Text>
      <Text style={muted}>
        Pokud jste tuto pozvánku neočekávali, e-mail můžete ignorovat.
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
