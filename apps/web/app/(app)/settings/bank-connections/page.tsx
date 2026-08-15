import { issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { LandmarkIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";

import { connectFio, disconnectFio, syncFio } from "@/actions/payments";
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
import { and, asc, eq } from "drizzle-orm";

type SearchParams = {
  connected?: string;
  disconnected?: string;
  synced?: string;
  imported?: string;
  proposed?: string;
  error?: string;
};

function issuerName(snapshot: Record<string, unknown>): string {
  return typeof snapshot.name === "string" ? snapshot.name : "Unnamed issuer";
}

export default async function BankConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ workspaceId, role }, params] = await Promise.all([
    requireWorkspace(),
    searchParams,
  ]);
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

      {params.error && params.error !== "NEXT_REDIRECT" ? (
        <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          Connection error: {params.error.replaceAll("_", " ")}
        </p>
      ) : null}
      {params.connected || params.synced || params.disconnected ? (
        <p className="border-brand/20 bg-brand/5 rounded-lg border px-4 py-3 text-sm">
          {params.connected
            ? "Fio account connected."
            : params.disconnected
              ? "Fio access disconnected; imported ledger history was preserved."
              : `Sync complete: ${params.imported ?? "0"} new transactions, ${params.proposed ?? "0"} proposals.`}
        </p>
      ) : null}

      {connections.map((connection) => (
        <Card key={connection.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Fio banka</CardTitle>
                <CardDescription className="mt-1 font-mono">
                  {connection.accountNumber} · {connection.iban}
                </CardDescription>
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
          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Currency</dt>
                <dd>{connection.currency}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last successful sync</dt>
                <dd>
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
        <Card>
          <CardHeader>
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
    </div>
  );
}
