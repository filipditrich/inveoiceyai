"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
} from "lucide-react";

import { recordAccountSecurityEventAction } from "@/actions/security";
import { authClient } from "@/lib/auth/client";
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

function formatWhen(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
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

  const reload = () => {
    startTransition(async () => {
      const res = await authClient.apiKey.list();
      if (res.error) {
        toast.error(res.error.message || "Klíče se nenačetly");
        return;
      }
      setKeys(asKeyList(res.data));
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const create = () => {
    setBusyKey("create");
    startTransition(async () => {
      try {
        const label = name.trim() || "Remote MCP";
        const res = await authClient.apiKey.create({ name: label });
        if (res.error) {
          toast.error(res.error.message || "Vytvoření selhalo");
          return;
        }
        const created = createdKeyFields(res.data);
        if (created.key) setCreatedRaw(created.key);
        await recordAccountSecurityEventAction({
          type: "api_key_create",
          metadata: { keyId: created.id ?? null, name: label },
        });
        setName("");
        toast.success("Klíč vytvořen — zkopírujte ho teď");
        reload();
      } finally {
        setBusyKey(null);
      }
    });
  };

  const revoke = (keyId: string) => {
    if (!window.confirm("Opravdu odvolat tento API klíč? Nelze vrátit.")) {
      return;
    }
    setBusyKey(`revoke:${keyId}`);
    startTransition(async () => {
      try {
        const res = await authClient.apiKey.delete({ keyId });
        if (res.error) {
          toast.error(res.error.message || "Odvolání selhalo");
          return;
        }
        await recordAccountSecurityEventAction({
          type: "api_key_revoke",
          metadata: { keyId },
        });
        toast.success("Klíč odvolán");
        reload();
      } finally {
        setBusyKey(null);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">API klíče</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Osobní tokeny pro <strong>remote MCP</strong> (
          <code className="text-xs">/api/mcp</code>). Váží se na váš výchozí
          workspace. Eve HTTP a Slack používají jiné autorizace — ne tento klíč.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4" />
            Vaše klíče
          </CardTitle>
          <CardDescription>
            Celý token se zobrazí jen jednou při vytvoření. Ops klíč{" "}
            <code className="text-xs">MCP_API_KEY</code> zůstává jako
            deploymentová záloha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {createdRaw ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2 font-medium">
                <span>Nový klíč (zobrazí se jen teď)</span>
                <Badge variant="outline">Jednorázově</Badge>
              </div>
              <code className="block break-all text-xs">{createdRaw}</code>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyText(createdRaw, "Klíč zkopírován")}
                >
                  <CopyIcon data-icon="inline-start" />
                  Kopírovat klíč
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCreatedRaw(null)}
                >
                  Skrýt
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Název klíče (např. Cursor)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-xs"
            />
            <Button
              disabled={pending}
              loading={busyKey === "create"}
              onClick={create}
            >
              {busyKey === "create" ? "Vytvářím…" : "Vytvořit klíč"}
            </Button>
          </div>

          <div className="space-y-3">
            {keys.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Zatím žádné klíče. Vytvořte jeden a pokračujte nastavením MCP
                níže.
              </p>
            ) : (
              keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0 last:pb-0"
                >
                  <div>
                    <div className="font-medium">{k.name || "bez názvu"}</div>
                    <div className="text-muted-foreground">
                      {k.start ? `${k.start}…` : k.id.slice(0, 8)}
                      {" · "}
                      vytvořeno {formatWhen(k.createdAt)}
                      {k.lastRequest
                        ? ` · naposledy ${formatWhen(k.lastRequest)}`
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
                    {busyKey === `revoke:${k.id}` ? "Odvolávám…" : "Odvolat"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card id="mcp">
        <CardHeader>
          <CardTitle>Nastavení remote MCP</CardTitle>
          <CardDescription>
            Interaktivní průvodce pro Cursor (nebo jiného MCP klienta).
            Podrobnosti v dokumentaci.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ol className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                1
              </span>
              <div className="space-y-1">
                <p className="font-medium">Vytvořte nebo použijte klíč</p>
                <p className="text-muted-foreground">
                  {createdRaw
                    ? "Nový klíč je připravený — je vložený do ukázky níže."
                    : keys.length > 0
                      ? "Máte existující klíč. Celý token už nejde zobrazit — vytvořte nový, pokud ho nemáte uložený."
                      : "Nejprve vytvořte klíč výše. Bez něj vzdálené MCP požadavek odmítne."}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                2
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-medium">Vložte konfiguraci do Cursoru</p>
                <p className="text-muted-foreground">
                  Globálně do{" "}
                  <code className="text-xs">~/.cursor/mcp.json</code>, nebo do
                  projektového <code className="text-xs">.cursor/mcp.json</code>{" "}
                  (ten necommitujte).
                </p>
                <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs leading-relaxed">
                  {configSnippet}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyText(configSnippet, "Konfigurace zkopírována")
                    }
                  >
                    <CopyIcon data-icon="inline-start" />
                    Kopírovat JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyText(mcpUrl, "URL zkopírována")}
                  >
                    Kopírovat URL
                  </Button>
                </div>
                {!createdRaw ? (
                  <p className="text-muted-foreground text-xs">
                    Placeholder{" "}
                    <code className="text-[11px]">YOUR_API_KEY</code> nahraďte
                    skutečným tokenem.
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2Icon className="size-3.5" />
                    Ukázka obsahuje právě vytvořený klíč.
                  </p>
                )}
              </div>
            </li>
            <li className="flex gap-3">
              <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                3
              </span>
              <div className="space-y-1">
                <p className="font-medium">Ověřte nástroje</p>
                <p className="text-muted-foreground">
                  V Cursoru by se měly objevit nástroje Invoicey (např.{" "}
                  <code className="text-xs">list_invoices</code>). Endpoint:{" "}
                  <code className="text-xs">{mcpUrl}</code>
                </p>
              </div>
            </li>
          </ol>

          <div className="bg-muted/50 space-y-2 rounded-lg border px-3 py-2.5 text-sm">
            <p className="font-medium">Poznámky k autorizaci</p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs leading-relaxed">
              <li>
                Remote MCP přijímá váš PAT nebo ops{" "}
                <code className="text-[11px]">MCP_API_KEY</code>.
              </li>
              <li>Local stdio MCP (dev) nepoužívá PAT — viz dokumentaci.</li>
              <li>
                Slack bot a Eve HTTP nejdou přes tento klíč (Connect / ops
                klíče).
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link
              href="/docs/integrations/mcp"
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              MCP docs
              <ExternalLinkIcon className="size-3.5" />
            </Link>
            <Link
              href="/docs/integrations/cursor"
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              Cursor setup
              <ExternalLinkIcon className="size-3.5" />
            </Link>
            <Link
              href="/docs/integrations/api-keys"
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              API keys
              <ExternalLinkIcon className="size-3.5" />
            </Link>
            <Link
              href="/settings/integrations"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 hover:underline"
            >
              Slack a další integrace
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
