"use client";

import { ArrowDownIcon, ArrowRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { SlackMark } from "@/components/brand/slack-mark";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initialsFromLabel(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function PartyTile({
  caption,
  eyebrow,
  mark,
  title,
}: {
  caption?: string;
  eyebrow: string;
  mark: ReactNode;
  title: string;
}) {
  return (
    <div className="bg-muted/40 flex min-w-0 items-start gap-3 rounded-xl border px-3 py-3">
      {mark}
      <div className="min-w-0 space-y-0.5">
        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          {eyebrow}
        </p>
        <p className="wrap-break-word font-medium">{title}</p>
        {caption ? (
          <p className="text-muted-foreground wrap-break-word text-xs">
            {caption}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function SlackConnectionParties({
  className,
  slackCaption,
  slackEyebrow,
  slackTitle,
  stacked = false,
  workspaceCaption,
  workspaceEyebrow,
  workspaceTitle,
}: {
  className?: string;
  slackCaption?: string;
  slackEyebrow: string;
  slackTitle: string;
  stacked?: boolean;
  workspaceCaption?: string;
  workspaceEyebrow: string;
  workspaceTitle: string;
}) {
  return (
    <div
      className={cn(
        stacked
          ? "grid grid-cols-1 gap-2"
          : "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start sm:gap-3",
        className,
      )}
    >
      <PartyTile
        caption={slackCaption}
        eyebrow={slackEyebrow}
        mark={
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#4A154B]">
            <SlackMark size={18} />
          </span>
        }
        title={slackTitle}
      />
      <ArrowDownIcon
        aria-hidden
        className={cn(
          "text-muted-foreground mx-auto size-4",
          !stacked && "sm:hidden",
        )}
      />
      {stacked ? null : (
        <ArrowRightIcon
          aria-hidden
          className="text-muted-foreground hidden size-4 sm:block"
        />
      )}
      <PartyTile
        caption={workspaceCaption}
        eyebrow={workspaceEyebrow}
        mark={<BrandLogo size={40} />}
        title={workspaceTitle}
      />
    </div>
  );
}

export function SignedInUserRow({
  email,
  image,
  label,
  name,
}: {
  email: string;
  image?: string | null;
  label: string;
  name?: string | null;
}) {
  const display = name?.trim() || email;
  return (
    <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
      <Avatar size="default">
        {image ? <AvatarImage alt="" src={image} /> : null}
        <AvatarFallback>{initialsFromLabel(display)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          {label}
        </p>
        <p className="wrap-break-word text-sm font-medium">{display}</p>
        {name?.trim() ? (
          <p className="text-muted-foreground wrap-break-word text-xs">
            {email}
          </p>
        ) : null}
      </div>
    </div>
  );
}
