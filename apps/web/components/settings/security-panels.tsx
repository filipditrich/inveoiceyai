"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  getSecurityAuditAction,
  getTrustedDevicesAction,
  recordAccountSecurityEventAction,
  revokeTrustedDeviceAction,
} from "@/actions/security";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AccountRow = {
  id: string;
  providerId: string;
  accountId: string;
  createdAt: Date | string;
};

type SessionRow = {
  id: string;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date | string;
  expiresAt: Date | string;
};

function formatWhen(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function summarizeUa(ua?: string | null): string {
  const raw = ua?.trim() || "";
  if (!raw) return "Neznámé zařízení";
  return raw.length > 72 ? `${raw.slice(0, 69)}…` : raw;
}

export function LinkedAccountsPanel({
  configuredProviders,
}: {
  configuredProviders: Array<"google" | "github">;
}) {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [pending, startTransition] = useTransition();

  const reload = () => {
    startTransition(async () => {
      const res = await authClient.listAccounts();
      if (res.error) {
        toast.error(res.error.message || "Nepodařilo se načíst účty");
        return;
      }
      setAccounts((res.data ?? []) as AccountRow[]);
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const linked = new Set(accounts.map((a) => a.providerId));

  const unlink = (providerId: string) => {
    if (accounts.length <= 1) {
      toast.error("Nelze odpojit poslední způsob přihlášení");
      return;
    }
    startTransition(async () => {
      const res = await authClient.unlinkAccount({ providerId });
      if (res.error) {
        toast.error(res.error.message || "Odpojení selhalo");
        return;
      }
      await recordAccountSecurityEventAction({
        type: "account_unlink",
        metadata: { providerId },
      });
      toast.success("Poskytovatel odpojen");
      reload();
    });
  };

  const link = (provider: "google" | "github") => {
    startTransition(async () => {
      await authClient.linkSocial({
        provider,
        callbackURL: "/settings/security?linked=1",
      });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Způsoby přihlášení</CardTitle>
        <CardDescription>
          Google a GitHub. Poslední poskytovatel nelze odpojit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {configuredProviders.map((provider) => {
          const isLinked = linked.has(provider);
          return (
            <div
              key={provider}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div>
                <div className="font-medium capitalize">{provider}</div>
                <div className="text-muted-foreground">
                  {isLinked ? "Propojeno" : "Nepropojeno"}
                </div>
              </div>
              {isLinked ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending || accounts.length <= 1}
                  onClick={() => unlink(provider)}
                >
                  Odpojit
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => link(provider)}
                >
                  Propojit
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function SessionsPanel({
  currentToken,
  revokeOthersOnMount,
}: {
  currentToken?: string;
  revokeOthersOnMount?: boolean;
}) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [pending, startTransition] = useTransition();

  const reload = () => {
    startTransition(async () => {
      const res = await authClient.listSessions();
      if (res.error) {
        toast.error(res.error.message || "Nepodařilo se načíst relace");
        return;
      }
      setSessions((res.data ?? []) as SessionRow[]);
    });
  };

  useEffect(() => {
    startTransition(async () => {
      if (revokeOthersOnMount) {
        await authClient.revokeOtherSessions();
        await recordAccountSecurityEventAction({
          type: "account_link",
          metadata: { source: "oauth_callback" },
        });
        await recordAccountSecurityEventAction({
          type: "session_revoke",
          metadata: { scope: "others", reason: "post_link" },
        });
        toast.success("Ostatní relace odvolány po propojení účtu");
        const url = new URL(window.location.href);
        url.searchParams.delete("linked");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
      const res = await authClient.listSessions();
      if (res.error) {
        toast.error(res.error.message || "Nepodařilo se načíst relace");
        return;
      }
      setSessions((res.data ?? []) as SessionRow[]);
    });
  }, [revokeOthersOnMount]);

  const revoke = (token: string) => {
    startTransition(async () => {
      const res = await authClient.revokeSession({ token });
      if (res.error) {
        toast.error(res.error.message || "Odvolání selhalo");
        return;
      }
      await recordAccountSecurityEventAction({
        type: "session_revoke",
        metadata: { scope: "one" },
      });
      toast.success("Relace odvolána");
      reload();
    });
  };

  const revokeOthers = () => {
    startTransition(async () => {
      const res = await authClient.revokeOtherSessions();
      if (res.error) {
        toast.error(res.error.message || "Odvolání selhalo");
        return;
      }
      await recordAccountSecurityEventAction({
        type: "session_revoke",
        metadata: { scope: "others" },
      });
      toast.success("Ostatní relace odvolány");
      reload();
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Aktivní relace</CardTitle>
          <CardDescription>
            IP, prohlížeč a možnost odvolat přístup.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={revokeOthers}
        >
          Odvolat ostatní
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">Žádné relace.</p>
        ) : (
          sessions.map((s) => {
            const isCurrent = Boolean(currentToken && s.token === currentToken);
            return (
              <div
                key={s.id}
                className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{summarizeUa(s.userAgent)}</div>
                  <div className="text-muted-foreground">
                    {s.ipAddress || "IP neznámá"} · {formatWhen(s.createdAt)}
                    {isCurrent ? " · tato relace" : ""}
                  </div>
                </div>
                {!isCurrent ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => revoke(s.token)}
                  >
                    Odvolat
                  </Button>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export function TrustedDevicesPanel() {
  const [devices, setDevices] = useState<
    Awaited<ReturnType<typeof getTrustedDevicesAction>>
  >([]);
  const [pending, startTransition] = useTransition();

  const reload = () => {
    startTransition(async () => {
      setDevices(await getTrustedDevicesAction());
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const revoke = (deviceId: string) => {
    startTransition(async () => {
      const res = await revokeTrustedDeviceAction(deviceId);
      if (!res.ok) {
        toast.error("Odvolání zařízení selhalo");
        return;
      }
      toast.success("Zařízení odvoláno");
      reload();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Důvěryhodná zařízení</CardTitle>
        <CardDescription>
          Soft trust — nové zařízení dostane e-mail, přihlášení vždy projde.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {devices.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Zatím žádná důvěryhodná zařízení.
          </p>
        ) : (
          devices.map((d) => (
            <div
              key={d.id}
              className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
            >
              <div className="space-y-1 text-sm">
                <div className="font-medium">
                  {d.label || summarizeUa(d.userAgent)}
                </div>
                <div className="text-muted-foreground">
                  {d.lastIp || "IP neznámá"} · naposledy{" "}
                  {formatWhen(d.lastSeenAt)}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => revoke(d.id)}
              >
                Odvolat
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function SecurityAuditPanel() {
  const [events, setEvents] = useState<
    Awaited<ReturnType<typeof getSecurityAuditAction>>
  >([]);

  useEffect(() => {
    void getSecurityAuditAction().then(setEvents);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nedávná aktivita</CardTitle>
        <CardDescription>
          Audit přihlášení a bezpečnostních akcí.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">Zatím žádné záznamy.</p>
        ) : (
          events.map((e) => (
            <div key={e.id} className="text-sm">
              <span className="font-medium">{e.type}</span>
              <span className="text-muted-foreground">
                {" "}
                · {formatWhen(e.createdAt)}
                {e.ipAddress ? ` · ${e.ipAddress}` : ""}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
