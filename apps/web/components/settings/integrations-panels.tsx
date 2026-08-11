import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  TerminalIcon,
} from "lucide-react";

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
      <SlackSetupGuide />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <TerminalIcon className="text-muted-foreground size-4" />
            Remote MCP
          </CardTitle>
          <CardDescription>
            Používejte nástroje Invoicey přímo z Cursoru, Claude Code nebo
            jiného MCP klienta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              "Vytváření validovaných návrhů",
              "ARES dohledání klientů",
              "Správa vystavených faktur",
            ].map((item) => (
              <div
                className="bg-muted/35 flex items-start gap-2 rounded-lg border px-3 py-3 text-sm"
                key={item}
              >
                <CheckCircle2Icon className="text-brand mt-0.5 size-4 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button render={<Link href="/settings/api-keys#mcp" />}>
              Připojit MCP klienta
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button
              variant="outline"
              render={<Link href="/docs/integrations/mcp" />}
            >
              Dokumentace MCP
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
