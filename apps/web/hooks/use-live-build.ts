"use client";

import { useSyncExternalStore } from "react";
import {
  APP_GIT_SHA,
  AppBuildInfoSchema,
  isBuildStale,
  type AppBuildInfo,
} from "@/lib/app-build-info";

const POLL_MS = 10 * 60 * 1000;

export interface LiveBuildState {
  live: AppBuildInfo | null;
  isStale: boolean;
}

let live: AppBuildInfo | null = null;
let intervalId: number | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function getSnapshot(): AppBuildInfo | null {
  return live;
}

function getServerSnapshot(): AppBuildInfo | null {
  return null;
}

async function fetchLiveBuild(): Promise<AppBuildInfo | null> {
  try {
    const response = await fetch("/api/version", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const parsed = AppBuildInfoSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function check(): Promise<void> {
  const next = await fetchLiveBuild();
  if (!next) {
    return;
  }
  if (live?.sha === next.sha && live.version === next.version) {
    return;
  }
  live = next;
  emit();
}

function onResume(): void {
  if (document.visibilityState === "visible") {
    void check();
  }
}

function startPolling(): void {
  void check();
  if (intervalId !== null) {
    return;
  }
  intervalId = window.setInterval(onResume, POLL_MS);
  document.addEventListener("visibilitychange", onResume);
  window.addEventListener("focus", onResume);
}

function stopPolling(): void {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
  document.removeEventListener("visibilitychange", onResume);
  window.removeEventListener("focus", onResume);
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (listeners.size === 1) {
    startPolling();
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) {
      stopPolling();
    }
  };
}

export function useLiveBuild(): LiveBuildState {
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return {
    live: current,
    isStale: current
      ? isBuildStale({ runningSha: APP_GIT_SHA, liveSha: current.sha })
      : false,
  };
}
