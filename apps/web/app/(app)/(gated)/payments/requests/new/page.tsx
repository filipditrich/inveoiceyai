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
  const [{ workspaceId }, t, sp] = await Promise.all([
    requireWorkspace(),
    getTranslations("PaymentRequests.create"),
    searchParams,
    assertCan("payments:manage"),
  ]);
  const account = await resolveCollectingAccount(workspaceId);

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("description")}
        eyebrow={t("eyebrow")}
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
            <Button
              render={<Link href="/settings/workspace/bank-connections" />}
            >
              <LandmarkIcon /> {t("connectBank")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form action={createPaymentRequestAction} className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">{t("amount")}</Label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  name="amount"
                  placeholder="500.00"
                  required
                />
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
              <Button type="submit">{t("submit")}</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
