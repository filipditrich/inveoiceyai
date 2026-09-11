"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export function PocketOauthBounce({ href }: { href: string }) {
  const t = useTranslations("PocketOauth");
  useEffect(() => window.location.replace(href), [href]);
  return (
    <Button className="w-full" size="lg" render={<a href={href} />}>
      {t("openApp")}
    </Button>
  );
}
