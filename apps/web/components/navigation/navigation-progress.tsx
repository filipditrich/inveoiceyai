"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";

const SHOW_DELAY_MS = 100;
const MIN_VISIBLE_MS = 240;
const FAILSAFE_MS = 12_000;

const NavigationPendingContext = createContext(false);

export function useNavigationPending(): boolean {
  return useContext(NavigationPendingContext);
}

export function NavigationProgressProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);

  return (
    <NavigationPendingContext.Provider value={pending}>
      {children}
      <NavigationProgressBar />
      <Suspense fallback={null}>
        <NavigationProgressController onPendingChange={setPending} />
      </Suspense>
    </NavigationPendingContext.Provider>
  );
}

export function NavigationPendingOverlay({
  className,
}: {
  className?: string;
}) {
  const pending = useNavigationPending();
  const t = useTranslations("App.a11y");

  return (
    <div
      aria-busy={pending}
      aria-hidden={!pending}
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex items-start justify-center pt-20 transition-opacity duration-150",
        pending
          ? "pointer-events-auto bg-background/45 opacity-100 backdrop-blur-[1px]"
          : "opacity-0",
        className,
      )}
    >
      {pending ? (
        <div className="mt-2 flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm text-foreground shadow-sm">
          <Spinner className="size-3.5" />
          <span>{t("navigating")}</span>
        </div>
      ) : null}
    </div>
  );
}

function NavigationProgressBar() {
  const pending = useNavigationPending();
  const t = useTranslations("App.a11y");

  return (
    <>
      <div
        aria-hidden={!pending}
        className={cn(
          "pointer-events-none fixed top-0 right-0 left-0 z-200 h-0.5 overflow-hidden transition-opacity duration-150",
          pending ? "opacity-100" : "opacity-0",
        )}
        role="progressbar"
        aria-valuetext={pending ? t("navigating") : undefined}
      >
        <div className="h-full w-1/3 animate-navigation-indeterminate rounded-full bg-brand" />
      </div>
      <span aria-live="polite" className="sr-only">
        {pending ? t("navigating") : ""}
      </span>
    </>
  );
}

function NavigationProgressController({
  onPendingChange,
}: {
  onPendingChange: (pending: boolean) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAt = useRef<number | null>(null);
  const pendingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (failsafeTimer.current) {
      clearTimeout(failsafeTimer.current);
      failsafeTimer.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (pendingRef.current || showTimer.current) {
      return;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    showTimer.current = setTimeout(() => {
      showTimer.current = null;
      pendingRef.current = true;
      shownAt.current = Date.now();
      onPendingChange(true);
      failsafeTimer.current = setTimeout(() => {
        pendingRef.current = false;
        shownAt.current = null;
        onPendingChange(false);
      }, FAILSAFE_MS);
    }, SHOW_DELAY_MS);
  }, [onPendingChange]);

  const stop = useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (failsafeTimer.current) {
      clearTimeout(failsafeTimer.current);
      failsafeTimer.current = null;
    }
    if (!pendingRef.current) {
      return;
    }
    const elapsed = shownAt.current ? Date.now() - shownAt.current : 0;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null;
      pendingRef.current = false;
      shownAt.current = null;
      onPendingChange(false);
    }, wait);
  }, [onPendingChange]);

  useEffect(() => {
    stop();
  }, [pathname, searchParams, stop]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || !shouldTrackAnchorNavigation(anchor)) {
        return;
      }
      start();
    }

    function onPopState() {
      start();
    }

    window.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, [clearTimers, start]);

  return null;
}

function shouldTrackAnchorNavigation(anchor: HTMLAnchorElement): boolean {
  if (anchor.hasAttribute("download")) {
    return false;
  }
  const target = anchor.getAttribute("target");
  if (target && target !== "" && target !== "_self") {
    return false;
  }
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:")) {
    return false;
  }
  let next: URL;
  try {
    next = new URL(href, window.location.href);
  } catch {
    return false;
  }
  if (next.origin !== window.location.origin) {
    return false;
  }
  const current = new URL(window.location.href);
  return next.pathname !== current.pathname || next.search !== current.search;
}
