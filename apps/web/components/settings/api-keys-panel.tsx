"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  ShieldAlertIcon,
  SquareTerminalIcon,
} from "lucide-react";

import { recordAccountSecurityEventAction } from "@/actions/security";
import { authClient } from "@/lib/auth/client";
import type { AppLocale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type KeyRow = {
  id: string;
  name?: string | null;
  start?: string | null;
  createdAt: Date | string;
  lastRequest?: Date | string | null;
};

type CreatedKey = {
  id?: string;
  key?: string;
  data?: { id?: string; key?: string };
};

function asKeyList(data: unknown): KeyRow[] {
  if (Array.isArray(data)) return data as KeyRow[];
  if (data && typeof data === "object" && "apiKeys" in data) {
    const keys = (data as { apiKeys?: KeyRow[] }).apiKeys;
    return Array.isArray(keys) ? keys : [];
  }
  return [];
}

function createdKeyFields(data: unknown): { id?: string; key?: string } {
  const row = data as CreatedKey | null;
  return {
    id: row?.id ?? row?.data?.id,
    key: row?.key ?? row?.data?.key,
  };
}

function formatWhen(value: Date | string, locale: AppLocale): string {
  return formatDateTime(value, locale);
}

async function copyText(text: string, okMessage: string) {
  await navigator.clipboard.writeText(text);
  toast.success(okMessage);
}

function buildMcpConfig(mcpUrl: string, apiKey: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        invoicey: {
          url: mcpUrl,
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      },
    },
    null,
    2,
  );
}

export function ApiKeysPanel({ appUrl }: { appUrl: string }) {
  const t = useTranslations("Settings.apiKeys");
  const locale = useLocale() as AppLocale;
  const mcpUrl = `${appUrl.replace(/\/$/, "")}/api/mcp`;
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [name, setName] = useState("");
  const [createdRaw, setCreatedRaw] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const configSnippet = useMemo(
    () => buildMcpConfig(mcpUrl, createdRaw ?? "YOUR_API_KEY"),
    [mcpUrl, createdRaw],
  );

  const reload = useCallback(() => {
    startTransition(async () => {
      const res = await authClient.apiKey.list();
      if (res.error) {
        toast.error(res.error.message || t("loadFailed"));
        return;
      }
      setKeys(asKeyList(res.data));
    });
  }, [t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = () => {
    setBusyKey("create");
    startTransition(async () => {
      try {
        const label = name.trim() || t("defaultName");
        const res = await authClient.apiKey.create({ name: label });
        if (res.error) {
          toast.error(res.error.message || t("createFailed"));
          return;
        }
        const created = createdKeyFields(res.data);
        if (created.key) setCreatedRaw(created.key);
        await recordAccountSecurityEventAction({
          type: "api_key_create",
          metadata: { keyId: created.id ?? null, name: label },
        });
        setName("");
        toast.success(t("createSuccess"));
        reload();
      } finally {
        setBusyKey(null);
      }
    });
  };

  const revoke = (keyId: string) => {
    if (!window.confirm(t("revokeConfirm"))) {
      return;
    }
    setBusyKey(`revoke:${keyId}`);
    startTransition(async () => {
      try {
        const res = await authClient.apiKey.delete({ keyId });
        if (res.error) {
          toast.error(res.error.message || t("revokeFailed"));
          return;
        }
        await recordAccountSecurityEventAction({
          type: "api_key_revoke",
          metadata: { keyId },
        });
        toast.success(t("revokeSuccess"));
        reload();
      } finally {
        setBusyKey(null);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <KeyRoundIcon className="text-muted-foreground size-4" />
            {t("yourKeys")}
          </CardTitle>
          <CardDescription>{t("yourKeysDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {createdRaw ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2 font-medium">
                <span>{t("newKeyTitle")}</span>
                <Badge variant="outline">{t("once")}</Badge>
              </div>
              <code className="block break-all text-xs">{createdRaw}</code>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyText(createdRaw, t("keyCopied"))}
                >
                  <CopyIcon data-icon="inline-start" />
                  {t("copyKey")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCreatedRaw(null)}
                >
                  {t("hide")}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="space-y-1.5 text-sm font-medium">
              {t("nameLabel")}
              <Input
                placeholder={t("namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <Button
              disabled={pending}
              loading={busyKey === "create"}
              onClick={create}
            >
              <KeyRoundIcon />
              {busyKey === "create" ? t("creating") : t("createKey")}
            </Button>
          </div>

          <div className="space-y-3 border-t pt-4">
            {pending && keys.length === 0 ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-7 text-sm">
                <LoaderCircleIcon className="size-4 animate-spin" />
                {t("loading")}
              </div>
            ) : keys.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center rounded-lg border border-dashed px-4 py-7 text-center text-sm">
                <KeyRoundIcon className="mb-2 size-5 opacity-60" />
                <p className="text-foreground font-medium">{t("emptyTitle")}</p>
                <p className="mt-1 max-w-sm">{t("emptyHint")}</p>
              </div>
            ) : (
              keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0 last:pb-0"
                >
                  <div>
                    <div className="font-medium">{k.name || t("noName")}</div>
                    <div className="text-muted-foreground">
                      {k.start ? `${k.start}…` : k.id.slice(0, 8)}
                      {" · "}
                      {t("createdAt", {
                        when: formatWhen(k.createdAt, locale),
                      })}
                      {k.lastRequest
                        ? ` · ${t("lastUsed", { when: formatWhen(k.lastRequest, locale) })}`
                        : ""}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    loading={busyKey === `revoke:${k.id}`}
                    onClick={() => revoke(k.id)}
                  >
                    {busyKey === `revoke:${k.id}` ? t("revoking") : t("revoke")}
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card id="mcp">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <SquareTerminalIcon className="text-muted-foreground size-4" />
            {t("mcpTitle")}
          </CardTitle>
          <CardDescription>{t("mcpDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ol className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                1
              </span>
              <div className="space-y-1">
                <p className="font-medium">{t("mcpStep1Title")}</p>
                <p className="text-muted-foreground">
                  {createdRaw
                    ? t("mcpStep1Ready")
                    : keys.length > 0
                      ? t("mcpStep1Existing")
                      : t("mcpStep1Empty")}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                2
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-medium">{t("mcpStep2Title")}</p>
                <p className="text-muted-foreground">
                  {t("mcpStep2Body", {
                    global: "~/.cursor/mcp.json",
                    project: ".cursor/mcp.json",
                  })}
                </p>
                <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs leading-relaxed">
                  {configSnippet}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyText(configSnippet, t("configCopied"))}
                  >
                    <CopyIcon data-icon="inline-start" />
                    {t("copyJson")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyText(mcpUrl, t("urlCopied"))}
                  >
                    {t("copyUrl")}
                  </Button>
                </div>
                {!createdRaw ? (
                  <p className="text-muted-foreground text-xs">
                    {t("placeholderHint", { placeholder: "YOUR_API_KEY" })}
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2Icon className="size-3.5" />
                    {t("snippetHasKey")}
                  </p>
                )}
              </div>
            </li>
            <li className="flex gap-3">
              <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                3
              </span>
              <div className="space-y-1">
                <p className="font-medium">{t("mcpStep3Title")}</p>
                <p className="text-muted-foreground">
                  {t("mcpStep3Body", { tool: "list_invoices", url: mcpUrl })}
                </p>
              </div>
            </li>
          </ol>

          <div className="bg-muted/50 flex items-start gap-3 rounded-lg border px-3 py-3 text-sm">
            <ShieldAlertIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div className="space-y-2">
              <p className="font-medium">{t("whichKeyTitle")}</p>
              <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs leading-relaxed">
                <li>{t("whichKeyPat", { env: "MCP_API_KEY" })}</li>
                <li>{t("whichKeyStdio")}</li>
                <li>{t("whichKeySlack")}</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link
              href="/docs/integrations/mcp"
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              {t("docsMcp")}
              <ExternalLinkIcon className="size-3.5" />
            </Link>
            <Link
              href="/docs/integrations/cursor"
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              {t("docsCursor")}
              <ExternalLinkIcon className="size-3.5" />
            </Link>
            <Link
              href="/docs/integrations/api-keys"
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              {t("docsKeys")}
              <ExternalLinkIcon className="size-3.5" />
            </Link>
            <Link
              href="/settings/integrations"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 hover:underline"
            >
              {t("integrationsLink")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
