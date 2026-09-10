"use client";

import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";

import {
  createNavigationPendingMachine,
  navigationLocationKey,
  shouldStartPendingOnPopState,
} from "./navigation-pending";

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
  const lastReactLocationRef = useRef("");
  const machineRef = useRef<ReturnType<
    typeof createNavigationPendingMachine
  > | null>(null);
  if (machineRef.current === null) {
    machineRef.current = createNavigationPendingMachine({
      onChange: setPending,
    });
  }
  const machine = machineRef.current;

  useEffect(() => {
    return () => {
      machine.dispose();
    };
  }, [machine]);

  return (
    <NavigationPendingContext.Provider value={pending}>
      {children}
      <NavigationProgressBar />
      <NavigationIntentListener
        lastReactLocationRef={lastReactLocationRef}
        machine={machine}
      />
      <Suspense fallback={null}>
        <NavigationLocationListener
          lastReactLocationRef={lastReactLocationRef}
          machine={machine}
        />
      </Suspense>
    </NavigationPendingContext.Provider>
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

function NavigationIntentListener({
  lastReactLocationRef,
  machine,
}: {
  lastReactLocationRef: MutableRefObject<string>;
  machine: ReturnType<typeof createNavigationPendingMachine>;
}) {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const eventTarget = event.target;
      const anchor =
        eventTarget instanceof Element ? eventTarget.closest("a") : null;
      if (!anchor || !shouldTrackAnchorNavigation(anchor)) {
        return;
      }
      machine.start();
    }

    function onPopState() {
      const browserLocation = navigationLocationKey(
        window.location.pathname,
        window.location.search,
      );
      if (
        !shouldStartPendingOnPopState(
          browserLocation,
          lastReactLocationRef.current,
        )
      ) {
        machine.stop();
        return;
      }
      machine.start();
    }

    window.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [lastReactLocationRef, machine]);

  return null;
}

function NavigationLocationListener({
  lastReactLocationRef,
  machine,
}: {
  lastReactLocationRef: MutableRefObject<string>;
  machine: ReturnType<typeof createNavigationPendingMachine>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const location = navigationLocationKey(pathname, searchParams.toString());

  useEffect(() => {
    lastReactLocationRef.current = location;
    machine.stop();
  }, [lastReactLocationRef, location, machine]);

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
