"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AtSignIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Link2Icon,
  MessageSquareIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

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
          <MessageSquareIcon className="size-4 text-muted-foreground" />
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
                  className="flex gap-3 rounded-xl border bg-muted/35 px-3 py-3"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-xs font-medium text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Icon className="size-3.5 text-muted-foreground" />
                      {t(step.titleKey)}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">{t("hitlIntro")}</p>
          <div className="space-y-2">
            {HITL_TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <code className="text-xs font-medium">{tool.name}</code>
                <span className="text-xs text-muted-foreground">
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
            <p className="text-xs text-muted-foreground">{t("accessBody")}</p>
          </div>
        </div>

        <Link
          href="/docs/integrations/slack"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {t("docsLink")}
          <ExternalLinkIcon className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
