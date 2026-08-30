"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AtSignIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Link2Icon,
  MessageSquareIcon,
  TriangleAlertIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

export function SlackSetupGuide() {
  const t = useTranslations("Settings.slack");

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <MessageSquareIcon className="text-muted-foreground size-4" />
          {t("title")}
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
            <p className="text-muted-foreground text-xs">{t("accessBody")}</p>
          </div>
        </div>

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
