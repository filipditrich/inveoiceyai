import { createPaymentRequestAction } from "@/actions/payment-requests";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { requireWorkspace } from "@/lib/auth/session";
import { assertCan } from "@/lib/authz/can";
import { resolveCollectingAccount } from "@/lib/payments/payment-request-account";
import { LandmarkIcon, QrCodeIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function NewPaymentRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ workspaceId }, t, tNav, sp] = await Promise.all([
    requireWorkspace(),
    getTranslations("PaymentRequests.create"),
    getTranslations("App.nav"),
    searchParams,
    assertCan("payments:manage"),
  ]);
  const account = await resolveCollectingAccount(workspaceId);

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/payments/requests", label: t("back") }}
        description={t("description")}
        eyebrow={tNav("payments")}
        icon={<QrCodeIcon />}
        title={t("title")}
      />

      {!account ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("noConnection")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/payments/connections" />} size="sm">
              <LandmarkIcon data-icon="inline-start" />
              {t("connectBank")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form action={createPaymentRequestAction} className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">{t("amount")}</Label>
                <InputGroup className="h-9">
                  <InputGroupInput
                    id="amount"
                    inputMode="decimal"
                    name="amount"
                    placeholder="500.00"
                    required
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>CZK</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <p className="text-xs text-muted-foreground">
                  {t("amountHint")}
                </p>
                {sp.error === "invalid_amount" ? (
                  <p className="text-xs text-destructive">
                    {t("invalidAmount")}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">{t("note")}</Label>
                <Input
                  id="message"
                  name="message"
                  placeholder={t("notePlaceholder")}
                />
              </div>
              <div className="space-y-1 rounded-xl border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {t("accountLabel")}
                </p>
                <p className="text-sm font-medium tabular-nums">
                  {t("accountHint", { account: account.accountNumber })}
                </p>
              </div>
              <Button type="submit">{t("submit")}</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
