"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  HistoryIcon,
  Link2Icon,
  LoaderCircleIcon,
  MonitorSmartphoneIcon,
  ShieldCheckIcon,
} from "lucide-react";

import {
  getSecurityAuditAction,
  getTrustedDevicesAction,
  recordAccountSecurityEventAction,
  revokeTrustedDeviceAction,
} from "@/actions/security";
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

function formatWhen(value: Date | string, locale: AppLocale = "cs"): string {
  return formatDateTime(value, locale);
}

const AUDIT_TYPE_KEYS = [
  "sign_in",
  "session_revoke",
  "account_link",
  "account_unlink",
  "device_trust",
  "device_revoke",
  "api_key_create",
  "api_key_revoke",
  "invite_create",
  "invite_resend",
  "invite_cancel",
  "invite_accept",
  "invite_reject",
  "member_remove",
  "member_role_update",
  "platform_admin_grant",
  "platform_admin_revoke",
] as const;

function summarizeUa(ua?: string | null): string {
  const raw = ua?.trim() || "";
  if (!raw) return "Neznámé zařízení";

  let browser = "Prohlížeč";
  if (/Edg\//i.test(raw)) browser = "Edge";
  else if (/Chrome\//i.test(raw) && !/Edg\//i.test(raw)) browser = "Chrome";
  else if (/Firefox\//i.test(raw)) browser = "Firefox";
  else if (/Safari\//i.test(raw) && !/Chrome\//i.test(raw)) browser = "Safari";

  let os = "";
  if (/Windows/i.test(raw)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(raw)) os = "macOS";
  else if (/Android/i.test(raw)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(raw)) os = "iOS";
  else if (/Linux/i.test(raw)) os = "Linux";

  return os ? `${browser} · ${os}` : browser;
}

function ProviderIcon({ provider }: { provider: "google" | "github" }) {
  if (provider === "google") {
    return (
      <svg aria-hidden viewBox="0 0 24 24" className="size-4">
        <path
          fill="#4285F4"
          d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.74 2.98-4.31 2.98-7.39Z"
        />
        <path
          fill="#34A853"
          d="M12 22c2.7 0 4.98-.9 6.63-2.38l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z"
        />
        <path
          fill="#FBBC05"
          d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.12-1.32.31-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.53l3.35-2.61Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.95c1.47 0 2.78.5 3.82 1.5l2.88-2.87A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z"
        />
      </svg>
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-1.04-.02-1.89-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.66.35-1.12.64-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.35 9.35 0 0 1 12 6.97c.85 0 1.69.12 2.49.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.95.68 1.92 0 1.38-.01 2.5-.01 2.85 0 .27.18.59.69.49A10.22 10.22 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function providerLabel(provider: string): string {
  if (provider === "google") return "Google";
  if (provider === "github") return "GitHub";
  return provider;
}

export function LinkedAccountsPanel({
  configuredProviders,
}: {
  configuredProviders: Array<"google" | "github">;
}) {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

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
    setBusyKey(`unlink:${providerId}`);
    startTransition(async () => {
      try {
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
      } finally {
        setBusyKey(null);
      }
    });
  };

  const link = (provider: "google" | "github") => {
    setBusyKey(`link:${provider}`);
    startTransition(async () => {
      try {
        await authClient.linkSocial({
          provider,
          callbackURL: "/settings/security?linked=1",
        });
      } finally {
        setBusyKey(null);
      }
    });
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Link2Icon className="text-muted-foreground size-4" />
          Způsoby přihlášení
        </CardTitle>
        <CardDescription>
          OAuth přes Google nebo GitHub. Poslední poskytovatel nelze odpojit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        {pending && accounts.length === 0 ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm">
            <LoaderCircleIcon className="size-4 animate-spin" />
            Načítám přihlášení…
          </div>
        ) : configuredProviders.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Žádný poskytovatel není na serveru nastavený. Doplňte OAuth údaje a
            obnovte stránku.
          </p>
        ) : (
          configuredProviders.map((provider) => {
            const isLinked = linked.has(provider);
            return (
              <div
                key={provider}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex size-9 items-center justify-center rounded-md">
                    <ProviderIcon provider={provider} />
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">{providerLabel(provider)}</div>
                    <div className="text-muted-foreground">
                      {isLinked ? "Propojeno s účtem" : "Zatím nepropojeno"}
                    </div>
                  </div>
                </div>
                {isLinked ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Aktivní</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending || accounts.length <= 1}
                      loading={busyKey === `unlink:${provider}`}
                      onClick={() => unlink(provider)}
                    >
                      {busyKey === `unlink:${provider}`
                        ? "Odpojuji…"
                        : "Odpojit"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    disabled={pending}
                    loading={busyKey === `link:${provider}`}
                    onClick={() => link(provider)}
                  >
                    {busyKey === `link:${provider}`
                      ? "Přesměrovávám…"
                      : "Propojit"}
                  </Button>
                )}
              </div>
            );
          })
        )}
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
  const [busyKey, setBusyKey] = useState<string | null>(null);

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
    setBusyKey(`revoke:${token}`);
    startTransition(async () => {
      try {
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
      } finally {
        setBusyKey(null);
      }
    });
  };

  const revokeOthers = () => {
    setBusyKey("revoke-others");
    startTransition(async () => {
      try {
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
      } finally {
        setBusyKey(null);
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <MonitorSmartphoneIcon className="text-muted-foreground size-4" />
            Aktivní relace
          </CardTitle>
          <CardDescription>
            Kde jste přihlášeni. Podezřelé relace odvolejte.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={pending || sessions.length <= 1}
          loading={busyKey === "revoke-others"}
          onClick={revokeOthers}
        >
          {busyKey === "revoke-others" ? "Odvolávám…" : "Odvolat ostatní"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        {pending && sessions.length === 0 ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-sm">
            <LoaderCircleIcon className="size-4 animate-spin" />
            Načítám relace…
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-muted-foreground flex items-start gap-2 rounded-lg border border-dashed px-4 py-5 text-sm">
            <MonitorSmartphoneIcon className="mt-0.5 size-4 shrink-0" />
            <p>
              Žádné aktivní relace. Po přihlášení se tu objeví tento prohlížeč.
            </p>
          </div>
        ) : (
          sessions.map((s) => {
            const isCurrent = Boolean(currentToken && s.token === currentToken);
            return (
              <div
                key={s.id}
                className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {summarizeUa(s.userAgent)}
                    </span>
                    {isCurrent ? (
                      <Badge variant="secondary">Tato relace</Badge>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground">
                    {s.ipAddress || "IP neznámá"} · od {formatWhen(s.createdAt)}
                  </div>
                </div>
                {!isCurrent ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    loading={busyKey === `revoke:${s.token}`}
                    onClick={() => revoke(s.token)}
                  >
                    {busyKey === `revoke:${s.token}` ? "Odvolávám…" : "Odvolat"}
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
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const reload = () => {
    startTransition(async () => {
      setDevices(await getTrustedDevicesAction());
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const revoke = (deviceId: string) => {
    setBusyKey(`revoke:${deviceId}`);
    startTransition(async () => {
      try {
        const res = await revokeTrustedDeviceAction(deviceId);
        if (!res.ok) {
          toast.error("Odvolání zařízení selhalo");
          return;
        }
        toast.success("Zařízení odvoláno");
        reload();
      } finally {
        setBusyKey(null);
      }
    });
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon className="text-muted-foreground size-4" />
          Důvěryhodná zařízení
        </CardTitle>
        <CardDescription>
          Na přihlášení z nového zařízení vás upozorníme e-mailem. Přístup tím
          není blokován. Odkaz v e-mailu zařízení označí jako důvěryhodné.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        {pending && devices.length === 0 ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-sm">
            <LoaderCircleIcon className="size-4 animate-spin" />
            Načítám zařízení…
          </div>
        ) : devices.length === 0 ? (
          <div className="text-muted-foreground flex items-start gap-2 rounded-lg border border-dashed px-4 py-5 text-sm">
            <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" />
            <p>
              Zatím žádná důvěryhodná zařízení. Po přihlášení z nového místa
              použijte odkaz „Důvěřovat“ v e-mailu.
            </p>
          </div>
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
                loading={busyKey === `revoke:${d.id}`}
                onClick={() => revoke(d.id)}
              >
                {busyKey === `revoke:${d.id}` ? "Odvolávám…" : "Odvolat"}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function SecurityAuditPanel() {
  const t = useTranslations("Settings.security.audit");
  const locale = useLocale() as AppLocale;
  const [events, setEvents] = useState<
    Awaited<ReturnType<typeof getSecurityAuditAction>>
  >([]);

  useEffect(() => {
    void getSecurityAuditAction().then(setEvents);
  }, []);

  const auditLabel = (type: string): string => {
    if ((AUDIT_TYPE_KEYS as readonly string[]).includes(type)) {
      return t(`types.${type as (typeof AUDIT_TYPE_KEYS)[number]}`);
    }
    return type;
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <HistoryIcon className="text-muted-foreground size-4" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-5">
        {events.length === 0 ? (
          <div className="text-muted-foreground flex items-start gap-2 rounded-lg border border-dashed px-4 py-5 text-sm">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
            <p>{t("empty")}</p>
          </div>
        ) : (
          events.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b py-2 text-sm last:border-0"
            >
              <span className="font-medium">{auditLabel(e.type)}</span>
              <span className="text-muted-foreground">
                {formatWhen(e.createdAt, locale)}
                {e.ipAddress ? ` · ${e.ipAddress}` : ""}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
