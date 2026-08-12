import { Button, Text } from "@react-email/components";
import * as React from "react";

import { EmailShell } from "../components/email-shell";

export type NewSignInEmailProps = {
  userName: string;
  ipAddress: string | null;
  userAgent: string | null;
  signedInAt: string;
  trustUrl: string;
  securitySettingsUrl: string;
};

export function NewSignInEmail(props: NewSignInEmailProps) {
  const title = "Nové přihlášení do Invoicey";

  return (
    <EmailShell
      preview="Detekovali jsme přihlášení z nového zařízení"
      title={title}
      variant="system"
      footerLink={{
        label: "Nastavení zabezpečení",
        href: props.securitySettingsUrl,
      }}
    >
      <Text style={bodyText}>
        Ahoj{props.userName.trim() ? ` ${props.userName.trim()}` : ""},
        zaznamenali jsme přihlášení z zařízení, které zatím není důvěryhodné.
      </Text>
      <Text style={bodyText}>
        <strong>Čas:</strong> {props.signedInAt}
        <br />
        <strong>IP:</strong> {props.ipAddress?.trim() || "neznámá"}
        <br />
        <strong>Prohlížeč:</strong> {props.userAgent?.trim() || "neznámý"}
      </Text>
      <Text style={bodyText}>
        Pokud jste to byli vy, můžete zařízení označit jako důvěryhodné. Pokud
        ne, odvolejte relace v nastavení zabezpečení.
      </Text>
      <Button href={props.trustUrl} style={button}>
        Důvěřovat tomuto zařízení
      </Button>
      <Text style={muted}>
        <a href={props.securitySettingsUrl} style={link}>
          Otevřít nastavení zabezpečení
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
