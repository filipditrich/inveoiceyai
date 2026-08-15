import { issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";
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
import Image from "next/image";

import {
  connectFio,
  disconnectFio,
  syncFio,
  toggleFioAutoMatch,
} from "@/actions/payments";
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
import { requireWorkspace } from "@/lib/auth/session";
import { listFioConnections } from "@/lib/payments/fio-service";
import { isBankTokenEncryptionConfigured } from "@/lib/payments/token-crypto";
import { asc, eq } from "drizzle-orm";

function issuerName(snapshot: Record<string, unknown>): string {
  return typeof snapshot.name === "string" ? snapshot.name : "Unnamed issuer";
}

const PLANNED_BANKS = [
  { name: "Komerční banka", short: "KB", color: "bg-red-600 text-white" },
  { name: "MONETA Money Bank", short: "M", color: "bg-teal-700 text-white" },
  { name: "Česká spořitelna", short: "ČS", color: "bg-blue-700 text-white" },
  { name: "ČSOB", short: "ČSOB", color: "bg-blue-900 text-white" },
] as const;

export default async function BankConnectionsPage() {
  const { workspaceId, role } = await requireWorkspace();
  const [connections, issuers] = await Promise.all([
    listFioConnections(workspaceId),
    db
      .select({ id: issuerBusinesses.id, snapshot: issuerBusinesses.snapshot })
      .from(issuerBusinesses)
      .where(eq(issuerBusinesses.workspaceId, workspaceId))
      .orderBy(asc(issuerBusinesses.createdAt)),
  ]);
  const canManage = role === "admin" || role === "owner";
  const encryptionReady = isBankTokenEncryptionConfigured();

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description="Connect a read-only bank feed to this workspace. Tokens and accounts are never shared with your other workspaces."
        icon={<LandmarkIcon />}
        title="Bank connections"
      />

      {connections.map((connection) => (
        <Card key={connection.id} className="overflow-hidden">
          <CardHeader className="bg-muted/20 border-b">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-4">
                <div className="shadow-xs flex h-14 w-36 shrink-0 items-center rounded-xl border bg-white px-3">
                  <Image
                    alt="Fio banka"
                    src="/banks/fio.svg"
                    width={180}
                    height={64}
                    className="h-auto w-full"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>Fio banka</CardTitle>
                    <Badge variant="outline" className="gap-1">
                      <LockKeyholeIcon className="size-3" /> Read-only
                    </Badge>
                  </div>
                  <CardDescription className="mt-1 truncate font-mono">
                    {connection.accountNumber} · {connection.iban}
                  </CardDescription>
                </div>
              </div>
              <Badge
                variant={
                  connection.status === "active" ? "default" : "secondary"
                }
              >
                {connection.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="bg-muted/35 rounded-xl p-3">
                <dt className="text-muted-foreground text-xs">
                  Imported currency
                </dt>
                <dd className="mt-1 font-medium">{connection.currency}</dd>
              </div>
              <div className="bg-muted/35 rounded-xl p-3 sm:col-span-2">
                <dt className="text-muted-foreground text-xs">
                  Last successful sync
                </dt>
                <dd className="mt-1 font-medium">
                  {connection.lastSyncSucceededAt?.toLocaleString("cs-CZ") ??
                    "Not synced yet"}
                </dd>
              </div>
            </dl>
            {connection.lastSyncErrorCode ? (
              <p className="text-destructive text-sm">
                Last error: {connection.lastSyncErrorCode.replaceAll("_", " ")}
              </p>
            ) : null}
            <div className="border-brand/15 bg-brand/[0.05] flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span className="bg-brand/10 text-brand flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <ZapIcon className="size-5" />
                </span>
                <div>
                  <p className="font-medium">Automatic exact matching</p>
                  <p className="text-muted-foreground mt-0.5 max-w-2xl text-sm leading-relaxed">
                    When the receiving account, CZK currency, variable symbol,
                    and full amount due all match exactly, mark the invoice paid
                    and email you. Partial or ambiguous payments always wait for
                    review.
                  </p>
                </div>
              </div>
              <form action={toggleFioAutoMatch} className="shrink-0">
                <input
                  type="hidden"
                  name="connectionId"
                  value={connection.id}
                />
                <input
                  type="hidden"
                  name="enabled"
                  value={connection.autoConfirmExactMatches ? "false" : "true"}
                />
                <Button
                  type="submit"
                  variant={
                    connection.autoConfirmExactMatches ? "default" : "outline"
                  }
                  disabled={!canManage || connection.status !== "active"}
                  role="switch"
                  aria-checked={connection.autoConfirmExactMatches}
                >
                  <span
                    aria-hidden
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      connection.autoConfirmExactMatches
                        ? "bg-primary-foreground/25"
                        : "bg-muted-foreground/25"
                    }`}
                  >
                    <span
                      className={`bg-background absolute top-0.5 size-4 rounded-full shadow-sm transition-transform ${
                        connection.autoConfirmExactMatches
                          ? "translate-x-[18px]"
                          : "translate-x-0.5"
                      }`}
                    />
                  </span>
                  {connection.autoConfirmExactMatches ? "On" : "Off"}
                </Button>
              </form>
            </div>
            {canManage && connection.status === "active" ? (
              <div className="flex flex-wrap gap-2">
                <form action={syncFio}>
                  <input
                    type="hidden"
                    name="connectionId"
                    value={connection.id}
                  />
                  <Button type="submit" variant="outline">
                    <RefreshCwIcon /> Sync now
                  </Button>
                </form>
                <form action={disconnectFio}>
                  <input
                    type="hidden"
                    name="connectionId"
                    value={connection.id}
                  />
                  <Button type="submit" variant="destructive">
                    <Trash2Icon /> Disconnect
                  </Button>
                </form>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}

      {connections.some(
        (connection) => connection.status === "active",
      ) ? null : (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="shadow-xs mb-2 flex h-14 w-36 items-center rounded-xl border bg-white px-3">
              <Image
                alt="Fio banka"
                src="/banks/fio.svg"
                width={180}
                height={64}
                className="h-auto w-full"
              />
            </div>
            <CardTitle>Connect Fio read-only API</CardTitle>
            <CardDescription>
              Create a read-only API token in Fio Internetbanking and paste it
              here. Invoicey validates it against today’s statement and stores
              it encrypted. The selected issuer’s default receiving account is
              updated to this verified Fio account for future invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!encryptionReady ? (
              <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm">
                Bank token encryption is not configured. Set
                {" BANK_TOKEN_ENCRYPTION_KEY_V1 "}
                before connecting an account.
              </p>
            ) : issuers.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Create your issuer business before connecting its receiving
                account.
              </p>
            ) : (
              <form action={connectFio} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="issuerId">Issuer receiving payments</Label>
                  <select
                    id="issuerId"
                    name="issuerId"
                    required
                    className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm"
                    defaultValue={issuers[0]?.id}
                  >
                    {issuers.map((issuer) => (
                      <option key={issuer.id} value={issuer.id}>
                        {issuerName(issuer.snapshot)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token">Fio API token</Label>
                  <Input
                    id="token"
                    name="token"
                    type="password"
                    required
                    minLength={64}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="64-character read-only token"
                  />
                  <p className="text-muted-foreground text-xs">
                    The connection belongs to this workspace. We never display
                    the token again and never request write access.
                  </p>
                  <a
                    className="text-brand inline-flex items-center gap-1 text-xs font-medium hover:underline"
                    href="https://www.fio.cz/bank-services/internetbanking-api"
                    rel="noreferrer"
                    target="_blank"
                  >
                    How to create a Fio API token
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </div>
                <Button type="submit" disabled={!canManage}>
                  Connect and verify
                </Button>
                {!canManage ? (
                  <p className="text-muted-foreground text-xs">
                    A workspace admin or owner must connect bank accounts.
                  </p>
                ) : null}
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CircleDotDashedIcon className="text-muted-foreground size-5" />
              More bank integrations
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Fio is the first provider. These connections are being evaluated
              next.
            </p>
          </div>
          <Badge variant="secondary">Planned</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PLANNED_BANKS.map((bank) => (
            <Card key={bank.name} className="border-dashed">
              <CardContent className="flex items-center gap-3 p-4">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${bank.color}`}
                >
                  {bank.short}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{bank.name}</p>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Building2Icon className="size-3" /> Coming later
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="border-border/70 bg-muted/25 flex gap-3 rounded-2xl border p-4 text-sm">
        <ShieldCheckIcon className="text-brand mt-0.5 size-5 shrink-0" />
        <p className="text-muted-foreground leading-relaxed">
          Connections belong to the current workspace, not your user account. A
          user in multiple workspaces connects and configures each workspace
          independently. Invoicey imports incoming transactions only; it cannot
          send money.
        </p>
      </div>
    </div>
  );
}
