"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { writeGeneratorHandoff } from "@/lib/generator/handoff";
import { appLocaleFrom, generatorPathForLocale } from "@/lib/generator/href";
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
    <div className="mx-auto max-w-2xl rounded-2xl border bg-background/70 px-6 py-8 text-left shadow-sm backdrop-blur">
      <h2 className="text-2xl font-semibold tracking-[-0.03em]">
        {t("title")}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
        {t("body")}
      </p>
      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center"
        onSubmit={onSubmit}
      >
        <Input
          aria-label={t("ico")}
          className="sm:max-w-[12rem]"
          inputMode="numeric"
          maxLength={8}
          onChange={(ev) => setIco(ev.target.value.replace(/\D/gu, ""))}
          placeholder={t("ico")}
          value={ico}
        />
        <Button className="shrink-0" type="submit">
          {t("cta")}
        </Button>
      </form>
    </div>
  );
}
