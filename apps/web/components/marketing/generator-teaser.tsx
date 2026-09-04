"use client";

import { useState, type FormEvent } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { appLocaleFrom, generatorPathForLocale } from "@/lib/generator/href";
import { ArrowRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function GeneratorTeaser() {
  const t = useTranslations("Marketing.generatorTeaser");
  const locale = appLocaleFrom(useLocale());
  const router = useRouter();
  const [ico, setIco] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const digits = ico.replace(/\D/gu, "").slice(0, 8);
    const path = generatorPathForLocale(locale);
    router.push(digits.length === 8 ? `${path}?ico=${digits}` : path);
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <form className="w-full" onSubmit={onSubmit}>
        <InputGroup className="h-12 rounded-full border-border/80 bg-background/80 pr-1 shadow-sm">
          <InputGroupInput
            aria-label={t("ico")}
            className="h-12 px-4"
            inputMode="numeric"
            maxLength={8}
            onChange={(ev) => setIco(ev.target.value.replace(/\D/gu, ""))}
            placeholder={t("ico")}
            value={ico}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              className="h-9 rounded-full px-4"
              size="sm"
              type="submit"
              variant="default"
            >
              {t("cta")}
              <ArrowRightIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
      <p className="mt-2.5 text-center text-xs text-muted-foreground">
        {t("hint")}
      </p>
    </div>
  );
}
