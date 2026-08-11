"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { recordAccountSecurityEventAction } from "@/actions/security";
import { authClient } from "@/lib/auth/client";
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

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [name, setName] = useState("");
  const [createdRaw, setCreatedRaw] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    startTransition(async () => {
      const label = name.trim() || "MCP / Eve";
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
    });
  };

  const revoke = (keyId: string) => {
    startTransition(async () => {
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
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API klíče</CardTitle>
        <CardDescription>
          Osobní tokeny pro remote MCP a Eve HTTP. Env ops klíč zůstává jako
          záloha.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {createdRaw ? (
          <div className="bg-muted break-all rounded-md p-3 text-sm">
            <div className="mb-1 font-medium">
              Nový klíč (zobrazí se jen teď)
            </div>
            <code>{createdRaw}</code>
            <div className="mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(createdRaw);
                  toast.success("Zkopírováno");
                }}
              >
                Kopírovat
              </Button>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Název klíče"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
          />
          <Button disabled={pending} onClick={create}>
            Vytvořit
          </Button>
        </div>
        <div className="space-y-3">
          {keys.length === 0 ? (
            <p className="text-muted-foreground text-sm">Žádné klíče.</p>
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
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => revoke(k.id)}
                >
                  Odvolat
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
