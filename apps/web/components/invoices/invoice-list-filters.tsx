"use client";

import {
  AppFilters,
  filtersFromRecord,
  recordFromFilters,
} from "@/components/data-grid/app-filters";
import type { Filter, FilterFieldConfig } from "@/components/reui/filters";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ORIGIN_PROVIDER_LABELS,
  type InvoiceOriginProvider,
} from "@invoicey/invoice-core/import";
import {
  DISPLAY_STATUS_LABELS,
  INVOICE_DISPLAY_STATUSES,
} from "@invoicey/invoice-core/status-display";
import {
  Building2Icon,
  CalendarIcon,
  SearchIcon,
  TagIcon,
  UserIcon,
} from "lucide-react";
import { useCallback, useMemo } from "react";

export type PartyOption = { id: string; name: string };

const ORIGIN_PROVIDERS = Object.keys(
  ORIGIN_PROVIDER_LABELS,
) as InvoiceOriginProvider[];

type InvoiceListFiltersProps = {
  status?: string;
  issuerId?: string;
  clientId?: string;
  originProvider?: string;
  q?: string;
  from?: string;
  to?: string;
  issuers: PartyOption[];
  clients: PartyOption[];
  onFiltersChange: (next: {
    status?: string;
    issuerId?: string;
    clientId?: string;
    originProvider?: string;
    q?: string;
    from?: string;
    to?: string;
  }) => void;
};

export function InvoiceListFilters({
  status,
  issuerId,
  clientId,
  originProvider,
  q,
  from,
  to,
  issuers,
  clients,
  onFiltersChange,
}: InvoiceListFiltersProps) {
  const fields = useMemo<FilterFieldConfig<string>[]>(
    () => [
      {
        key: "q",
        label: "Hledat",
        type: "text",
        icon: <SearchIcon className="size-3.5" />,
        placeholder: "číslo, klient…",
        defaultOperator: "contains",
      },
      {
        key: "status",
        label: "Stav",
        type: "select",
        icon: <CalendarIcon className="size-3.5" />,
        defaultOperator: "is",
        options: INVOICE_DISPLAY_STATUSES.map((s) => ({
          value: s,
          label: DISPLAY_STATUS_LABELS[s],
        })),
      },
      {
        key: "originProvider",
        label: "Zdroj",
        type: "select",
        icon: <TagIcon className="size-3.5" />,
        defaultOperator: "is",
        options: ORIGIN_PROVIDERS.map((p) => ({
          value: p,
          label: ORIGIN_PROVIDER_LABELS[p],
        })),
      },
      {
        key: "issuerId",
        label: "Dodavatel",
        type: "select",
        icon: <Building2Icon className="size-3.5" />,
        defaultOperator: "is",
        searchable: true,
        options: issuers.map((i) => ({ value: i.id, label: i.name })),
      },
      {
        key: "clientId",
        label: "Odběratel",
        type: "select",
        icon: <UserIcon className="size-3.5" />,
        defaultOperator: "is",
        searchable: true,
        options: clients.map((c) => ({ value: c.id, label: c.name })),
      },
    ],
    [issuers, clients],
  );

  const filters = useMemo(
    () =>
      filtersFromRecord(
        { status, issuerId, clientId, originProvider, q },
        fields,
      ),
    [status, issuerId, clientId, originProvider, q, fields],
  );

  const emit = useCallback(
    (nextFilters: Filter<string>[], dates: { from?: string; to?: string }) => {
      const rec = recordFromFilters(nextFilters);
      onFiltersChange({
        status: rec.status,
        issuerId: rec.issuerId,
        clientId: rec.clientId,
        originProvider: rec.originProvider,
        q: rec.q,
        from: dates.from,
        to: dates.to,
      });
    },
    [onFiltersChange],
  );

  const handleFiltersChange = (next: Filter<string>[]) => {
    emit(next, { from, to });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <AppFilters
        fields={fields}
        filters={filters}
        onChange={handleFiltersChange}
      />
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs" htmlFor="inv-from">
            Od
          </Label>
          <Input
            className="h-8 w-36"
            id="inv-from"
            onChange={(e) => {
              const v = e.target.value || undefined;
              emit(filters, { from: v, to });
            }}
            type="date"
            value={from ?? ""}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs" htmlFor="inv-to">
            Do
          </Label>
          <Input
            className="h-8 w-36"
            id="inv-to"
            onChange={(e) => {
              const v = e.target.value || undefined;
              emit(filters, { from, to: v });
            }}
            type="date"
            value={to ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
