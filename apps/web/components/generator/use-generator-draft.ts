"use client";

import { useEffect, useRef, useState } from "react";
import {
  parseGeneratorDraftUrl,
  sampleGeneratorDraft,
  withPrefillNumber,
  type GeneratorDraft,
} from "@/lib/generator/draft";
import {
  loadGeneratorDraft,
  saveGeneratorDraft,
} from "@/lib/generator/draft-recovery";
import { readGeneratorHandoff } from "@/lib/generator/handoff";
import { parseAsJson, parseAsString, useQueryState } from "nuqs";

import type { AppLocale } from "@/i18n/config";

const draftUrlParser = parseAsJson(parseGeneratorDraftUrl).withOptions({
  history: "replace",
});

function freshDraft(locale: AppLocale) {
  return sampleGeneratorDraft({
    issuerId: crypto.randomUUID(),
    clientId: crypto.randomUUID(),
    locale,
  });
}

export function useGeneratorDraft(locale: AppLocale) {
  const [icoParam, setIcoParam] = useQueryState("ico", parseAsString);
  const [draftUrl, setDraftUrl] = useQueryState("d", draftUrlParser);
  const [draft, setDraft] = useState<GeneratorDraft | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const lastIssuerIco = useRef("");
  const lastClientIco = useRef("");

  useEffect(() => {
    if (draft) return;
    const fromQuery = (icoParam ?? "").replace(/\D/gu, "").slice(0, 8);
    const saved = draftUrl ?? loadGeneratorDraft();
    if (
      saved &&
      (draftUrl || fromQuery.length !== 8 || saved.issuer.ico === fromQuery)
    ) {
      lastIssuerIco.current = saved.issuer.ico;
      lastClientIco.current = saved.client.ico;
      setRecovered(true);
      setDraft(withPrefillNumber(saved));
    } else {
      const sample = freshDraft(locale);
      const issuerIco =
        fromQuery.length === 8
          ? fromQuery
          : (readGeneratorHandoff().issuerIco ?? "");
      lastIssuerIco.current = issuerIco ? "" : sample.issuer.ico;
      lastClientIco.current = sample.client.ico;
      setDraft(
        issuerIco
          ? { ...sample, issuer: { ...sample.issuer, ico: issuerIco } }
          : sample,
      );
    }
    // Existing links remain importable, but subsequent edits stay in this tab.
    void setDraftUrl(null);
  }, [draft, draftUrl, icoParam, locale, setDraftUrl]);

  useEffect(() => {
    if (draft) setStorageAvailable(saveGeneratorDraft(draft));
  }, [draft]);

  function resetDraft() {
    const sample = freshDraft(locale);
    lastIssuerIco.current = sample.issuer.ico;
    lastClientIco.current = sample.client.ico;
    setRecovered(false);
    void setIcoParam(null);
    setDraft(sample);
  }

  return {
    draft,
    setDraft,
    lastIssuerIco,
    lastClientIco,
    recovered,
    storageAvailable,
    resetDraft,
  };
}
