import Link from "next/link";
import { ArrowRightIcon, ExternalLinkIcon, TerminalIcon } from "lucide-react";

import { SlackSetupGuide } from "@/components/settings/slack-setup-guide";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function IntegrationsPanels() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Integrace</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Jak připojit Slack bota a remote MCP. Podrobné EN návody jsou v
          dokumentaci — tady je praktický přehled a autorizace.
        </p>
      </div>

      <SlackSetupGuide />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TerminalIcon className="size-4" />
            Remote MCP
          </CardTitle>
          <CardDescription>
            Osobní API klíč + konfigurace klienta (Cursor, Claude Code). Token
            váže nástroje na váš výchozí workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm leading-relaxed">
            <li>
              Autorizace: Bearer PAT ze Settings, nebo ops{" "}
              <code className="text-xs">MCP_API_KEY</code>.
            </li>
            <li>Local stdio (dev) bez PAT — jen pro checkout repozitáře.</li>
            <li>Eve HTTP PAT nepřijímá — jen ops klíče / OIDC / localDev.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button render={<Link href="/settings/api-keys#mcp" />}>
              Nastavit MCP
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button
              variant="outline"
              render={<Link href="/docs/integrations/mcp" />}
            >
              MCP docs
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
