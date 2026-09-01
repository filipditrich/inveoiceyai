"use client";

import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSidebar } from "@/components/ui/sidebar";
import { useLiveBuild } from "@/hooks/use-live-build";
import {
  APP_GIT_SHA,
  APP_VERSION,
  type AppBuildInfo,
} from "@/lib/app-build-info";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const triggerClass =
  "rounded-md font-mono text-[0.65rem] tracking-wide tabular-nums outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50";

export function BuildMark() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { live, isStale } = useLiveBuild();

  if (collapsed && !isStale) {
    return null;
  }

  return (
    <div aria-live="polite">
      {isStale && live ? (
        <StaleBuildButton collapsed={collapsed} live={live} />
      ) : (
        <CurrentBuildPopover />
      )}
    </div>
  );
}

function CurrentBuildPopover() {
  const t = useTranslations("App.build");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeoutId = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  async function copySha(): Promise<void> {
    try {
      await navigator.clipboard.writeText(APP_GIT_SHA);
      setCopied(true);
    } catch {
      /** clipboard may be denied */
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("runningWithSha", {
          version: APP_VERSION,
          sha: APP_GIT_SHA,
        })}
        className={cn(
          triggerClass,
          "w-full px-2 py-1 text-left text-muted-foreground hover:text-foreground",
        )}
      >
        {APP_VERSION}
        <span className="mx-1.5 opacity-40" aria-hidden>
          ·
        </span>
        {APP_GIT_SHA}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 gap-2 p-3" side="top">
        <PopoverHeader>
          <PopoverTitle className="font-mono text-sm tabular-nums">
            {APP_VERSION}
          </PopoverTitle>
        </PopoverHeader>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {APP_GIT_SHA}
          </span>
          <button
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => void copySha()}
            type="button"
          >
            {copied ? t("copied") : t("copySha")}
          </button>
        </div>
        <PopoverDescription>{t("upToDate")}</PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}

interface StaleBuildButtonProps {
  collapsed: boolean;
  live: AppBuildInfo;
}

function StaleBuildButton({ collapsed, live }: StaleBuildButtonProps) {
  const t = useTranslations("App.build");
  const label = t("reloadWithVersion", { version: live.version });

  return (
    <button
      aria-label={label}
      className={cn(
        triggerClass,
        "text-foreground hover:bg-sidebar-accent",
        collapsed
          ? "flex size-8 items-center justify-center px-0.5 text-center text-[0.55rem] leading-none"
          : "w-full px-2 py-1 text-left",
      )}
      onClick={() => window.location.reload()}
      title={label}
      type="button"
    >
      {collapsed ? live.version : label}
    </button>
  );
}
