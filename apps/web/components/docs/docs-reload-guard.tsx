"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import {
  DOCS_RELOAD_BLOCKED_KEY,
  DOCS_RELOAD_STORAGE_KEY,
  parseDocsLoadStamps,
  recordDocsLoads,
} from "@/lib/docs-reload-guard";
import { useTranslations } from "next-intl";

function subscribe() {
  return () => undefined;
}

function readBlockedFlag(): boolean {
  try {
    return sessionStorage.getItem(DOCS_RELOAD_BLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Stops a docs tab that is full-page reloading in a tight loop. The Vercel
 * WAF rate limit is the backstop for RSC fetch storms that never remount.
 */
export function DocsReloadGuard({ children }: { children: ReactNode }) {
  const storedBlock = useSyncExternalStore(
    subscribe,
    readBlockedFlag,
    () => false,
  );
  const [trippedHere, setTrippedHere] = useState(false);
  const [released, setReleased] = useState(false);
  const t = useTranslations("App.docs");

  useEffect(() => {
    if (storedBlock) {
      return;
    }
    try {
      const next = recordDocsLoads(
        parseDocsLoadStamps(sessionStorage.getItem(DOCS_RELOAD_STORAGE_KEY)),
        Date.now(),
      );
      sessionStorage.setItem(
        DOCS_RELOAD_STORAGE_KEY,
        JSON.stringify(next.timestamps),
      );
      if (next.tripped) {
        sessionStorage.setItem(DOCS_RELOAD_BLOCKED_KEY, "1");
        setTrippedHere(true);
      }
    } catch {
      /** private mode / disabled storage */
    }
  }, [storedBlock]);

  const blocked = (storedBlock || trippedHere) && !released;

  if (blocked) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-4 px-6 py-16">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("loopTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("loopBody")}</p>
        <Button
          className="self-start"
          onClick={() => {
            try {
              sessionStorage.removeItem(DOCS_RELOAD_BLOCKED_KEY);
              sessionStorage.removeItem(DOCS_RELOAD_STORAGE_KEY);
            } catch {
              /** private mode / disabled storage */
            }
            setReleased(true);
          }}
          type="button"
        >
          {t("loopContinue")}
        </Button>
      </div>
    );
  }

  return children;
}
