"use client";

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
  CopyIcon,
  LinkIcon,
  MousePointerClickIcon,
  UserPlusIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function ReferralsPanel({
  referralUrl,
  clicks,
  signups,
}: {
  referralUrl: string | null;
  clicks: number;
  signups: number;
}) {
  const t = useTranslations("Settings.referrals");

  const copy = async () => {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    toast.success(t("copied"));
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="size-4 text-muted-foreground" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {referralUrl ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                readOnly
                value={referralUrl}
                className="font-mono text-sm"
              />
              <Button variant="outline" onClick={() => void copy()}>
                <CopyIcon />
                {t("copy")}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("emptyCode")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>{t("statsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          <div className="rounded-lg border px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <MousePointerClickIcon className="size-3.5" />
              {t("clicks")}
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{clicks}</p>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <UserPlusIcon className="size-3.5" />
              {t("signups")}
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {signups}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
