"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

type InstallCommandProps = {
  readonly command: string;
  readonly copiedLabel: string;
  readonly copyLabel: string;
  readonly failedLabel: string;
};

export function InstallCommand({
  command,
  copiedLabel,
  copyLabel,
  failedLabel,
}: InstallCommandProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const copied = status === "copied";

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setStatus("idle"), 1_600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div>
      <div className="flex min-w-0 items-center border border-white/10 bg-[#1c1c1f] text-white shadow-2xl shadow-black/20">
        <span className="px-3 font-mono text-base text-primary select-none sm:px-4">
          $
        </span>
        {/* Overflows on narrow screens; focusable so it can be scrolled by keyboard. */}
        <code
          className="min-w-0 flex-1 overflow-x-auto py-5 font-mono text-xs whitespace-nowrap"
          tabIndex={0}
        >
          {command}
        </code>
        <button
          type="button"
          aria-label={copied ? copiedLabel : copyLabel}
          className="grid place-items-center self-stretch border-l border-white/10 px-3 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary sm:px-4"
          onClick={() => void copyCommand()}
        >
          {copied ? (
            <CheckIcon className="size-4 text-emerald-400" />
          ) : (
            <CopyIcon className="size-4" />
          )}
        </button>
      </div>
      <p
        role="status"
        className={
          status === "failed"
            ? "mt-2 text-xs leading-relaxed text-zinc-400"
            : "sr-only"
        }
      >
        {status === "failed" ? failedLabel : copied ? copiedLabel : null}
      </p>
    </div>
  );
}
