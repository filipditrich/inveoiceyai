import { issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { asc, eq } from "drizzle-orm";
import {
  Building2Icon,
  CircleDotDashedIcon,
  ExternalLinkIcon,
  LandmarkIcon,
  LockKeyholeIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import Image from "next/image";

import {
  connectFio,
  disableFioPayments,
  disconnectFio,
  disconnectMoneta,
  enableFioPayments,
  syncFio,
  syncMoneta,
  toggleFioAutoMatch,
  toggleMonetaAutoMatch,
} from "@/actions/payments";
import { AutoMatchToggle } from "@/components/settings/auto-match-toggle";
import { MonetaConnectForm } from "@/components/settings/moneta-connect-form";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
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
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/config";
import { isAppLocale } from "@/i18n/config";
import { requireWorkspace } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { messageLookup } from "@/lib/i18n-lookup";
import { listFioConnections } from "@/lib/payments/fio-service";
import { listMonetaConnections } from "@/lib/payments/moneta-service";
import { isBankTokenEncryptionConfigured } from "@/lib/payments/token-crypto";

const PLANNED_BANKS = [
  { id: "kb", logo: "/banks/kb.svg", note: "deferred" },
  { id: "rb", logo: "/banks/rb.svg", note: "deferred" },
  { id: "csas", logo: "/banks/csas-modern.svg", note: "deferred" },
  { id: "csob", logo: "/banks/csob.svg", note: "deferred" },
  { id: "creditas", logo: "/banks/creditas.jpg", note: "deferred" },
  { id: "revolut", logo: "/banks/revolut.svg", note: "deferred" },
  { id: "airbank", logo: "/banks/airbank.png", note: "notPlanned" },
  { id: "mbank", logo: "/banks/mbank.jpg", note: "notPlanned" },
  { id: "partners", logo: "/banks/partners.png", note: "notPlanned" },
] as const;

function issuerName(
  snapshot: Record<string, unknown>,
  fallback: string,
): string {
  return typeof snapshot.name === "string" ? snapshot.name : fallback;
}

function ConnectionStatusBadge({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <Badge
      variant={active ? "default" : "secondary"}
      className="gap-1.5 capitalize"
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${
          active ? "bg-emerald-400" : "bg-muted-foreground/60"
        }`}
      />
      {label}
    </Badge>
  );
}

function BankLogoTile({
  src,
  alt,
  inactive = false,
  size = "md",
}: {
  src: string;
  alt: string;
  inactive?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={`shadow-xs flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white p-2 ${
        size === "sm" ? "size-12" : "size-14"
      } ${inactive ? "opacity-40 grayscale" : ""}`}
    >
      <Image
        alt={alt}
        src={src}
        width={80}
        height={80}
        className="size-full object-contain"
      />
    </div>
  );
}

export default async function BankConnectionsPage() {
  const { workspaceId, role } = await requireWorkspace();
  const [t, localeValue, messages, fioConnections, monetaConnections, issuers] =
    await Promise.all([
      getTranslations("Settings.bankConnections"),
      getLocale(),
      getMessages(),
      listFioConnections(workspaceId),
      listMonetaConnections(workspaceId),
      db
        .select({
          id: issuerBusinesses.id,
          snapshot: issuerBusinesses.snapshot,
        })
        .from(issuerBusinesses)
        .where(eq(issuerBusinesses.workspaceId, workspaceId))
        .orderBy(asc(issuerBusinesses.createdAt)),
    ]);
  const locale: AppLocale = isAppLocale(localeValue) ? localeValue : "cs";
  const unnamedIssuer = t("unnamedIssuer");
  const canManage = role === "admin" || role === "owner";
  const encryptionReady = isBankTokenEncryptionConfigured();
  const issuerOptions = issuers.map((issuer) => ({
    id: issuer.id,
    label: issuerName(issuer.snapshot, unnamedIssuer),
  }));
  const hasActiveFio = fioConnections.some(
    (connection) => connection.status === "active",
  );
  const hasActiveMoneta = monetaConnections.some(
    (connection) => connection.status === "active",
  );
  const connections = [...fioConnections, ...monetaConnections];
  const statusLabels = messages.Settings.bankConnections.status;
  const errorLabels = messages.Settings.bankConnections.errors;

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description={t("pageDescription")}
        icon={<LandmarkIcon />}
        title={t("pageTitle")}
      />

      {connections.map((connection) => {
        const isMoneta = connection.provider === "moneta";
        const providerName = isMoneta
          ? t("providers.moneta")
          : t("providers.fio");
        const syncAction = isMoneta ? syncMoneta : syncFio;
        const disconnectAction = isMoneta ? disconnectMoneta : disconnectFio;
        const toggleAction = isMoneta
          ? toggleMonetaAutoMatch
          : toggleFioAutoMatch;
        return (
          <Card key={connection.id} className="overflow-hidden">
            <CardHeader className="bg-muted/20 border-b">
              {/* Grid items default to min-width:auto, which lets the
                  unbreakable IBAN push past the card instead of truncating. */}
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-4">
                  <BankLogoTile
                    alt={providerName}
                    src={isMoneta ? "/banks/moneta.png" : "/banks/fio.png"}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{providerName}</CardTitle>
                      <Badge variant="outline" className="gap-1">
                        <LockKeyholeIcon className="size-3" /> {t("readOnly")}
                      </Badge>
                    </div>
                    <CardDescription className="mt-1 truncate font-mono">
                      {connection.accountNumber} · {connection.iban}
                    </CardDescription>
                  </div>
                </div>
                <ConnectionStatusBadge
                  active={connection.status === "active"}
                  label={messageLookup(statusLabels, connection.status)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="bg-muted/35 rounded-xl p-3">
                  <dt className="text-muted-foreground text-xs">
                    {t("importedCurrency")}
                  </dt>
                  <dd className="mt-1 font-medium">{connection.currency}</dd>
                </div>
                <div className="bg-muted/35 rounded-xl p-3 sm:col-span-2">
                  <dt className="text-muted-foreground text-xs">
                    {t("lastSuccessfulSync")}
                  </dt>
                  <dd className="mt-1 font-medium">
                    {connection.lastSyncSucceededAt
                      ? formatDateTime(connection.lastSyncSucceededAt, locale)
                      : t("notSyncedYet")}
                  </dd>
                </div>
              </dl>
              {connection.lastSyncErrorCode ? (
                <p className="text-destructive text-sm">
                  {t("lastError", {
                    code: messageLookup(
                      errorLabels,
                      connection.lastSyncErrorCode,
                    ),
                  })}
                </p>
              ) : null}
              <div className="border-brand/15 bg-brand/[0.05] flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className="bg-brand/10 text-brand flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <ZapIcon className="size-5" />
                  </span>
                  <div>
                    <p className="font-medium">{t("autoMatchTitle")}</p>
                    <p className="text-muted-foreground mt-0.5 max-w-2xl text-sm leading-relaxed">
                      {t("autoMatchDescription")}
                    </p>
                  </div>
                </div>
                <AutoMatchToggle
                  connectionId={connection.id}
                  checked={connection.autoConfirmExactMatches}
                  disabled={!canManage || connection.status !== "active"}
                  action={toggleAction}
                />
              </div>
              {canManage && connection.status === "active" && !isMoneta ? (
                <div className="space-y-3 rounded-2xl border p-4">
                  <p className="font-medium">{t("paymentsTitle")}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t("paymentsCannotAuthorize")}
                  </p>
                  {"paymentEnabledAt" in connection &&
                  connection.paymentEnabledAt ? (
                    <p className="text-sm">
                      {t("paymentsEnabled")}
                      {connection.paymentTokenExpiresAt
                        ? ` · ${t("paymentsExpires", {
                            date: formatDateTime(
                              connection.paymentTokenExpiresAt,
                              locale,
                            ),
                          })}`
                        : ""}
                    </p>
                  ) : null}
                  <form
                    action={enableFioPayments}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <input
                      type="hidden"
                      name="connectionId"
                      value={connection.id}
                    />
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor={`paymentToken-${connection.id}`}>
                        {t("paymentsTokenLabel")}
                      </Label>
                      <Input
                        id={`paymentToken-${connection.id}`}
                        name="paymentToken"
                        type="password"
                        required
                        minLength={64}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={t("paymentsTokenPlaceholder")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`paymentTokenExpiresAt-${connection.id}`}>
                        {t("paymentsExpiresLabel")}
                      </Label>
                      <Input
                        id={`paymentTokenExpiresAt-${connection.id}`}
                        name="paymentTokenExpiresAt"
                        type="date"
                        required
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="submit">{t("paymentsEnable")}</Button>
                    </div>
                  </form>
                  {"paymentEnabledAt" in connection &&
                  connection.paymentEnabledAt ? (
                    <form action={disableFioPayments}>
                      <input
                        type="hidden"
                        name="connectionId"
                        value={connection.id}
                      />
                      <Button type="submit" variant="outline">
                        {t("paymentsDisable")}
                      </Button>
                    </form>
                  ) : null}
                </div>
              ) : null}
              {canManage && connection.status === "active" ? (
                <div className="flex flex-wrap gap-2">
                  <form action={syncAction}>
                    <input
                      type="hidden"
                      name="connectionId"
                      value={connection.id}
                    />
                    <Button type="submit" variant="outline">
                      <RefreshCwIcon /> {t("syncNow")}
                    </Button>
                  </form>
                  <form action={disconnectAction}>
                    <input
                      type="hidden"
                      name="connectionId"
                      value={connection.id}
                    />
                    <Button type="submit" variant="destructive">
                      <Trash2Icon /> {t("disconnect")}
                    </Button>
                  </form>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      {hasActiveFio ? null : (
        <Card className="overflow-hidden">
          <CardHeader>
            <BankLogoTile alt={t("providers.fio")} src="/banks/fio.png" />
            <CardTitle className="mt-2">{t("fio.connectTitle")}</CardTitle>
            <CardDescription>{t("fio.connectDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {!encryptionReady ? (
              <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm">
                {t("encryptionMissing")}
              </p>
            ) : issuers.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("needIssuer")}</p>
            ) : (
              <form action={connectFio} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="issuerId">{t("issuerLabel")}</Label>
                  <select
                    id="issuerId"
                    name="issuerId"
                    required
                    className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm"
                    defaultValue={issuers[0]?.id}
                  >
                    {issuers.map((issuer) => (
                      <option key={issuer.id} value={issuer.id}>
                        {issuerName(issuer.snapshot, unnamedIssuer)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token">{t("fio.tokenLabel")}</Label>
                  <Input
                    id="token"
                    name="token"
                    type="password"
                    required
                    minLength={64}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={t("fio.tokenPlaceholder")}
                  />
                  <p className="text-muted-foreground text-xs">
                    {t("fio.tokenHelp")}
                  </p>
                  <a
                    className="text-brand inline-flex items-center gap-1 text-xs font-medium hover:underline"
                    href="https://www.fio.cz/bankovni-sluzby/api-bankovnictvi"
                    rel="noreferrer"
                    target="_blank"
                  >
                    {t("fio.tokenGuide")}
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </div>
                <Button type="submit" disabled={!canManage}>
                  {t("connectAndVerify")}
                </Button>
                {!canManage ? (
                  <p className="text-muted-foreground text-xs">
                    {t("adminOnly")}
                  </p>
                ) : null}
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {hasActiveMoneta ? null : (
        <Card className="overflow-hidden">
          <CardHeader>
            <BankLogoTile alt={t("providers.moneta")} src="/banks/moneta.png" />
            <CardTitle className="mt-2">{t("moneta.connectTitle")}</CardTitle>
            <CardDescription>{t("moneta.connectDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <MonetaConnectForm
              issuers={issuerOptions}
              canManage={canManage}
              encryptionReady={encryptionReady}
            />
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CircleDotDashedIcon className="text-muted-foreground size-5" />
              {t("moreTitle")}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("moreDescription")}
            </p>
          </div>
          <Badge variant="secondary">{t("unavailable")}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PLANNED_BANKS.map((bank) => {
            const name = t(`banks.${bank.id}`);
            return (
              <Card
                key={bank.id}
                aria-disabled
                className="border-dashed opacity-55"
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <BankLogoTile alt={name} src={bank.logo} size="sm" inactive />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Building2Icon className="size-3" />{" "}
                      {bank.note === "deferred"
                        ? t("noteDeferred")
                        : t("noteNotPlanned")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="border-border/70 bg-muted/25 flex gap-3 rounded-2xl border p-4 text-sm">
        <ShieldCheckIcon className="text-brand mt-0.5 size-5 shrink-0" />
        <p className="text-muted-foreground leading-relaxed">{t("footer")}</p>
      </div>
    </div>
  );
}
