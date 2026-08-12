"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AtSignIcon,
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Link2Icon,
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

const HOW_IT_WORKS = [
  {
    icon: MessageSquareIcon,
    titleKey: "howInviteTitle",
    bodyKey: "howInviteBody",
  },
  {
    icon: Link2Icon,
    titleKey: "howLinkTitle",
    bodyKey: "howLinkBody",
  },
  {
    icon: AtSignIcon,
    titleKey: "howMentionTitle",
    bodyKey: "howMentionBody",
  },
  {
    icon: FileTextIcon,
    titleKey: "howDraftTitle",
    bodyKey: "howDraftBody",
  },
] as const;

const HITL_TOOLS = [
  { name: "issue_invoice", whyKey: "hitlIssue" },
  { name: "mark_invoice_paid", whyKey: "hitlPaid" },
  { name: "send_invoice_email", whyKey: "hitlEmail" },
] as const;

const OPERATOR_STEPS = [
  {
    titleKey: "step1Title",
    bodyKey: "step1Body",
    code: "VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1 vercel deploy --prod",
  },
  {
    titleKey: "step2Title",
    bodyKey: "step2Body",
    code: "vercel connect create slack --triggers\nvercel connect attach <uid> --triggers --trigger-path /eve/v1/slack --yes",
  },
  {
    titleKey: "step3Title",
    bodyKey: "step3Body",
  },
  {
    titleKey: "step4Title",
    bodyKey: "step4Body",
    code: "curl -sS https://your-host/eve/v1/health",
  },
] as const;

export function SlackSetupGuide() {
  const t = useTranslations("Settings.slack");
  const [operatorOpen, setOperatorOpen] = useState(false);

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success(t("copied"));
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <MessageSquareIcon className="text-muted-foreground size-4" />
          {t("title")}
          <Badge variant="secondary">Eve</Badge>
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <section className="space-y-3">
          <h3 className="text-sm font-medium">{t("howTitle")}</h3>
          <ol className="grid gap-2 sm:grid-cols-2">
            {HOW_IT_WORKS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.titleKey}
                  className="bg-muted/35 flex gap-3 rounded-xl border px-3 py-3"
                >
                  <span className="bg-background text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs font-medium">
                    {index + 1}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Icon className="text-muted-foreground size-3.5" />
                      {t(step.titleKey)}
                    </p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {t(step.bodyKey)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">{t("hitlTitle")}</h3>
          <p className="text-muted-foreground text-sm">{t("hitlIntro")}</p>
          <div className="space-y-2">
            {HITL_TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <code className="text-xs font-medium">{tool.name}</code>
                <span className="text-muted-foreground text-xs">
                  {t(tool.whyKey)}
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
              {t("accessTitle")}
            </p>
            <p className="text-muted-foreground text-xs">
              {t("accessBody")}
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
              {t("operatorTitle")}
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
              {t("operatorIntro")}
            </p>
            <ol className="space-y-4">
              {OPERATOR_STEPS.map((step, index) => (
                <li key={step.titleKey} className="flex gap-3 text-sm">
                  <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="font-medium">{t(step.titleKey)}</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {t(step.bodyKey)}
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
                          {t("copy")}
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
          {t("docsLink")}
          <ExternalLinkIcon className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
