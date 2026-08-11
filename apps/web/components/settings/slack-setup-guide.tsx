"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  MessageSquareIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const HITL_TOOLS = [
  {
    name: "issue_invoice",
    why: "Přidělí číslo a zmrazí fakturu — nevratné",
  },
  {
    name: "mark_invoice_paid",
    why: "Tvrdí, že peníze dorazily",
  },
  {
    name: "send_invoice_email",
    why: "Odešle e-mail skutečnému klientovi",
  },
] as const;

const OPERATOR_STEPS = [
  {
    title: "Deploy s Eve flagem",
    body: "Nastavte VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1 a Node 24+. Bez toho se /eve/v1/* nevygeneruje a Slack tiše nefunguje.",
    code: "VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1 vercel deploy --prod",
  },
  {
    title: "Vercel Connect → /eve/v1/slack",
    body: "Connect drží Slack credentials (žádné ruční SLACK_*). UID musí sedět s agentem (slack/invoicey).",
    code: "vercel connect create slack --triggers\nvercel connect attach <uid> --triggers --trigger-path /eve/v1/slack --yes",
  },
  {
    title: "Scopes a eventy + reinstall",
    body: "message.channels (a message.groups pro privátní kanály); scopes mimo jiné channels:history, groups:history, im:history, im:write, chat:write, app_mentions:read, files:write, files:read. Po změně scopes vždy reinstall Slack app.",
  },
  {
    title: "Env a healthcheck",
    body: "DATABASE_URL, AI Gateway / OIDC, NEXT_PUBLIC_APP_URL, UPLOADTHING_TOKEN dle potřeby. Eve HTTP používá EVE_API_KEY nebo MCP_API_KEY — ne osobní PAT ze Settings.",
    code: "curl -sS https://your-host/eve/v1/health",
  },
] as const;

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
  toast.success("Zkopírováno");
}

export function SlackSetupGuide() {
  const [operatorOpen, setOperatorOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <MessageSquareIcon className="text-muted-foreground size-4" />
          Invoicey pro Slack
          <Badge variant="secondary">Eve</Badge>
        </CardTitle>
        <CardDescription>
          Připravujte faktury v konverzaci. Vystavení, odeslání a potvrzení
          platby vždy vyžaduje souhlas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Jak funguje</h3>
          <ul className="text-muted-foreground list-inside list-disc space-y-1.5 text-sm leading-relaxed">
            <li>Pozvěte bota do kanálu, nebo mu napište DM.</li>
            <li>
              Zmínka <code className="text-xs">@Invoicey</code> nebo DM spustí
              relaci; v tom samém vlákně už zmínka není potřeba.
            </li>
            <li>
              Bot připraví návrh, připojí PDF a ISDOC a přidá odkaz do webové
              aplikace.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Akce vyžadující potvrzení</h3>
          <p className="text-muted-foreground text-sm">
            U těchto kroků se agent vždy zastaví a požádá o schválení:
          </p>
          <div className="space-y-2">
            {HITL_TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <code className="text-xs font-medium">{tool.name}</code>
                <span className="text-muted-foreground text-xs">
                  {tool.why}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div
          role="note"
          className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Přístup bota ke workspace
            </p>
            <p className="text-muted-foreground text-xs">
              Slack komunikuje přes <strong>Vercel Connect</strong> na{" "}
              <code className="text-[11px]">/eve/v1/slack</code>. Agent běží
              jako <strong>deployment</strong> (ops workspace), ne jako váš
              osobní API klíč. Kdokoli v kanálu má stejnou moc — držte bota v
              soukromém kanálu s lidmi, kteří smí fakturovat.
            </p>
          </div>
        </div>

        <Collapsible open={operatorOpen} onOpenChange={setOperatorOpen}>
          <CollapsibleTrigger
            className={cn(
              "hover:bg-muted/50 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
            )}
          >
            <span className="flex items-center gap-2">
              Technické nastavení nasazení
              <Badge variant="outline">CLI</Badge>
            </span>
            <ChevronDownIcon
              className={cn(
                "text-muted-foreground size-4 transition-transform",
                operatorOpen && "rotate-180",
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              Tato část je určená správci nasazení. Připojení probíhá přes
              Vercel CLI; osobní API klíč Slack neautorizuje.
            </p>
            <ol className="space-y-4">
              {OPERATOR_STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3 text-sm">
                  <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="font-medium">{step.title}</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {step.body}
                    </p>
                    {"code" in step && step.code ? (
                      <div className="space-y-2">
                        <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs leading-relaxed">
                          {step.code}
                        </pre>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyText(step.code)}
                        >
                          <CopyIcon data-icon="inline-start" />
                          Kopírovat
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>

        <Link
          href="/docs/integrations/slack"
          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
        >
          Podrobný návod pro Slack
          <ExternalLinkIcon className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
