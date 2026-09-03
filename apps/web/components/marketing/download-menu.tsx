"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  DownloadIcon,
  SquareTerminalIcon,
} from "lucide-react";
import Link from "next/link";

import { AppleLogo } from "./apple-logo";

type DownloadMenuLabels = Readonly<{
  cli: string;
  cliHint: string;
  label: string;
  mac: string;
  macHint: string;
  requirements: string;
  trigger: string;
}>;

type DownloadMenuProps = Readonly<{
  className?: string;
  labels: DownloadMenuLabels;
  macDownloadUrl: string;
}>;

/**
 * Header download control: one button, one menu, both companion apps.
 * The Mac entry leaves the app, so it stays a plain anchor.
 */
export function DownloadMenu({
  className,
  labels,
  macDownloadUrl,
}: DownloadMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className={cn(className)} />}
      >
        <DownloadIcon data-icon="inline-start" />
        {labels.trigger}
        <ChevronDownIcon
          data-icon="inline-end"
          className="text-muted-foreground"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72" sideOffset={8}>
        <DropdownMenuLabel>{labels.label}</DropdownMenuLabel>
        <DropdownMenuItem
          className="items-start gap-2.5 p-2"
          render={<a href={macDownloadUrl} />}
        >
          <AppleLogo className="mt-0.5 size-4" />
          <span className="flex-1">
            <span className="flex items-center gap-1.5 font-medium">
              {labels.mac}
              <ArrowUpRightIcon className="size-3 text-muted-foreground" />
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {labels.macHint}
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="items-start gap-2.5 p-2"
          render={<Link href="/docs/integrations/cli" />}
        >
          <SquareTerminalIcon className="mt-0.5 size-4" />
          <span className="flex-1">
            <span className="block font-medium">{labels.cli}</span>
            <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
              {labels.cliHint}
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-2 pb-1 text-xs text-muted-foreground">
          {labels.requirements}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
