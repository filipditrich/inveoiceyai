import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeModeSwitcher } from "@/components/theme-toggle";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import {
  LanguagesIcon,
  MonitorCogIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export default async function SettingsAccountPage() {
  const [t, tAppearance, tLocale, user] = await Promise.all([
    getTranslations("App.settings.account"),
    getTranslations("App.settings.appearance"),
    getTranslations("Common.locale"),
    requireSession(),
  ]);

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description={t("pageDescription")}
        icon={<UserRoundIcon />}
        title={t("pageTitle")}
      />
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <UserRoundIcon className="text-muted-foreground size-4" />
            {t("profileTitle")}
          </CardTitle>
          <CardDescription>{t("profileDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="flex items-center gap-4">
            <Avatar className="size-14" size="lg">
              {user.image ? (
                <AvatarImage alt={user.name} src={user.image} />
              ) : null}
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                {initialsFromName(user.name)}
              </AvatarFallback>
            </Avatar>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("oauthNote")}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account-name">{t("nameLabel")}</Label>
              <Input id="account-name" value={user.name} disabled readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-email">{t("emailLabel")}</Label>
              <Input id="account-email" value={user.email} disabled readOnly />
            </div>
          </div>
          <Link
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            href="/settings/security"
            prefetch
          >
            <ShieldCheckIcon className="size-4" />
            {t("securityLink")}
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <MonitorCogIcon className="text-muted-foreground size-4" />
            {tAppearance("title")}
          </CardTitle>
          <CardDescription>{tAppearance("description")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <ThemeModeSwitcher className="max-w-sm" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <LanguagesIcon className="text-muted-foreground size-4" />
            {tLocale("label")}
          </CardTitle>
          <CardDescription>
            {tAppearance("languageDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <LocaleSwitcher />
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {tAppearance("deviceNote")}
      </p>
    </div>
  );
}
