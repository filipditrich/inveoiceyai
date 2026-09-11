"use client";

import { Button } from "@/components/ui/button";
import {
  importHrefForOrigin,
  MIGRATION_PROVIDERS,
  type MigrationProvider,
} from "@/lib/migration-providers";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import Link from "next/link";

import type { InvoiceOriginProvider } from "@invoicey/invoice-core/import";

function MigrationProviderTile({
  provider,
  name,
  filesLabel,
  connectLabel,
  note,
  selected,
  onSelectOrigin,
}: {
  provider: MigrationProvider;
  name: string;
  filesLabel: string;
  connectLabel: string;
  note: string | null;
  selected: boolean;
  onSelectOrigin?: (origin: InvoiceOriginProvider) => void;
}) {
  const filesButton = onSelectOrigin ? (
    <Button onClick={() => onSelectOrigin(provider.id)} size="sm" type="button">
      {filesLabel}
    </Button>
  ) : (
    <Button
      render={<Link href={importHrefForOrigin(provider.id)} prefetch />}
      size="sm"
      type="button"
    >
      {filesLabel}
    </Button>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4",
        selected && "border-foreground",
      )}
    >
      <p className="leading-tight font-medium">{name}</p>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      <div className="mt-auto flex flex-wrap gap-2">
        {filesButton}
        <Button
          className="opacity-40 grayscale"
          disabled
          size="sm"
          title={note ?? undefined}
          type="button"
          variant="outline"
        >
          {connectLabel}
        </Button>
      </div>
    </div>
  );
}

export function MigrationProviderGrid({
  className,
  selectedOrigin,
  onSelectOrigin,
}: {
  className?: string;
  selectedOrigin?: InvoiceOriginProvider | null;
  onSelectOrigin?: (origin: InvoiceOriginProvider) => void;
}) {
  const t = useTranslations("Issuers.welcome.migrate");
  const tOrigin = useTranslations("Invoices.origin");
  return (
    <ul className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {MIGRATION_PROVIDERS.map((provider) => (
        <li key={provider.id}>
          <MigrationProviderTile
            connectLabel={t("connect")}
            filesLabel={t("uploadFiles")}
            name={tOrigin(provider.id)}
            note={provider.note ? t(`notes.${provider.note}`) : null}
            onSelectOrigin={onSelectOrigin}
            provider={provider}
            selected={selectedOrigin === provider.id}
          />
        </li>
      ))}
    </ul>
  );
}
