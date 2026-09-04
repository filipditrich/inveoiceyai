"use client";

import { useState, type FormEvent } from "react";
import { MARKETING_PILL_LG_CLASS } from "@/components/marketing/marketing-cta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { writeGeneratorHandoff } from "@/lib/generator/handoff";
import { appLocaleFrom, generatorPathForLocale } from "@/lib/generator/href";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function GeneratorTeaser() {
  const t = useTranslations("Marketing.generatorTeaser");
  const locale = appLocaleFrom(useLocale());
  const router = useRouter();
  const [ico, setIco] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    writeGeneratorHandoff({ issuerIco: ico });
    router.push(generatorPathForLocale(locale));
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center"
        onSubmit={onSubmit}
      >
        <Input
          aria-label={t("ico")}
          className="h-11 bg-background/80 sm:max-w-[11rem]"
          inputMode="numeric"
          maxLength={8}
          onChange={(ev) => setIco(ev.target.value.replace(/\D/gu, ""))}
          placeholder={t("ico")}
          value={ico}
        />
        <Button
          className={cn(
            "h-11 shrink-0 text-[0.95rem]",
            MARKETING_PILL_LG_CLASS,
          )}
          type="submit"
          variant="outline"
        >
          {t("cta")}
        </Button>
      </form>
      <p className="mt-2.5 text-center text-xs text-muted-foreground">
        {t("hint")}
      </p>
    </div>
  );
}
