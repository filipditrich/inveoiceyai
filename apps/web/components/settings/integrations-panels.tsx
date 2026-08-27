"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  TerminalIcon,
} from "lucide-react";

import {
  SlackIdentitiesPanel,
  type SlackIdentityView,
} from "@/components/settings/slack-identities-panel";
import { SlackSetupGuide } from "@/components/settings/slack-setup-guide";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function IntegrationsPanels({
  slackIdentities,
  currentWorkspaceId,
  currentWorkspaceName,
}: {
  slackIdentities: SlackIdentityView[];
  currentWorkspaceId: string;
  currentWorkspaceName: string;
}) {
  const t = useTranslations("Settings.integrations");
  const features = [
    t("mcpFeatureDrafts"),
    t("mcpFeatureAres"),
    t("mcpFeatureIssued"),
  ];
  return (
    <div className="flex flex-col gap-6">
      <SlackIdentitiesPanel
        identities={slackIdentities}
        currentWorkspaceId={currentWorkspaceId}
        currentWorkspaceName={currentWorkspaceName}
      />
      <SlackSetupGuide />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <TerminalIcon className="text-muted-foreground size-4" />
            {t("mcpTitle")}
          </CardTitle>
          <CardDescription>{t("mcpDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {features.map((item) => (
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
            <Button render={<Link href="/settings/workspace/api-keys#mcp" />}>
              {t("connectMcp")}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button
              variant="outline"
              render={<Link href="/docs/integrations/mcp" />}
            >
              {t("docsMcp")}
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
