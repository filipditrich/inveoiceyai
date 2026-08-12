"use client";

import {
  classifyImportPdfs,
  commitInvoiceImport,
  type ClassifiedImportFile,
  type CommitImportItem,
} from "@/actions/import-invoices";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { UploadDropzone } from "@/lib/uploadthing";
import {
  ORIGIN_PROVIDER_LABELS,
  buildExternalKey,
  type InvoiceOriginProvider,
} from "@invoicey/invoice-core/import";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type IssuerOption = { id: string; name: string };

type ImportStep = "settings" | "upload" | "review";

type ReviewRow = ClassifiedImportFile & {
  originProvider: InvoiceOriginProvider;
};

const PROVIDERS = Object.keys(
  ORIGIN_PROVIDER_LABELS,
) as InvoiceOriginProvider[];

const STEPS: Array<{ id: ImportStep; label: string }> = [
  { id: "settings", label: "Nastavení" },
  { id: "upload", label: "Nahrání" },
  { id: "review", label: "Kontrola" },
];

function archiveReady(row: ClassifiedImportFile): boolean {
  if (row.status === "ready_full" && row.invoice) {
    return true;
  }
  if (row.status !== "needs_archive_fields" || !row.archive) {
    return false;
  }
  const a = row.archive;
  return Boolean(
    a.meta.number.trim() &&
    a.meta.issueDate &&
    a.meta.dueDate &&
    a.client.name.trim() &&
    Number.isFinite(a.totals.total),
  );
}

function majorityProvider(
  rows: ClassifiedImportFile[],
): InvoiceOriginProvider | null {
  const counts = new Map<InvoiceOriginProvider, number>();
  for (const row of rows) {
    const provider = row.detectedOrigin.provider;
    if (provider === "custom") {
      continue;
    }
    counts.set(provider, (counts.get(provider) ?? 0) + 1);
  }
  let best: InvoiceOriginProvider | null = null;
  let bestCount = 0;
  for (const [provider, count] of counts) {
    if (count > bestCount) {
      best = provider;
      bestCount = count;
    }
  }
  return best;
}

function toReviewRows(rows: ClassifiedImportFile[]): ReviewRow[] {
  return rows.map((row) => ({
    ...row,
    originProvider: row.detectedOrigin.provider,
  }));
}

function resolveRowOrigin(
  row: ReviewRow,
  batch: {
    originProvider: InvoiceOriginProvider;
    originLabel: string;
    originVersion: string;
  },
): {
  provider: InvoiceOriginProvider;
  label?: string;
  version?: string;
} {
  const provider =
    row.originProvider === "custom" && batch.originProvider !== "custom"
      ? batch.originProvider
      : row.originProvider;
  return {
    provider,
    label: batch.originLabel || row.detectedOrigin.label,
    version: batch.originVersion || row.detectedOrigin.version,
  };
}

export function InvoiceImportForm({ issuers }: { issuers: IssuerOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>("settings");
  const [issuerId, setIssuerId] = useState(issuers[0]?.id ?? "");
  const [originProvider, setOriginProvider] =
    useState<InvoiceOriginProvider>("custom");
  const [originLabel, setOriginLabel] = useState("");
  const [originVersion, setOriginVersion] = useState("");
  const [originTouched, setOriginTouched] = useState(false);
  const [defaultPaid, setDefaultPaid] = useState(false);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<"classify" | "commit" | null>(null);

  const readyCount = useMemo(
    () => rows.filter((r) => archiveReady(r)).length,
    [rows],
  );

  const updateRow = (index: number, patch: Partial<ReviewRow>) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const updateArchiveField = (
    index: number,
    mutate: (archive: NonNullable<ReviewRow["archive"]>) => void,
  ) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index || !row.archive) {
          return row;
        }
        const archive = structuredClone(row.archive);
        mutate(archive);
        const externalKey = archive.meta.number
          ? buildExternalKey({
              provider: row.originProvider,
              number: archive.meta.number,
              issueDate: archive.meta.issueDate || "unknown",
            })
          : row.externalKey;
        return { ...row, archive, externalKey };
      }),
    );
  };

  const applyOriginToAll = () => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        originProvider,
      })),
    );
  };

  const onUploaded = (files: Array<{ name: string; ufsUrl: string }>) => {
    setMessage(null);
    setBusyKey("classify");
    startTransition(async () => {
      try {
        const result = await classifyImportPdfs({
          issuerId,
          defaultPaid,
          files: files.map((f) => ({
            fileName: f.name,
            pdfUrl: f.ufsUrl,
          })),
        });
        if (result.error) {
          setMessage(result.error);
          return;
        }
        const next = toReviewRows(result.rows);
        setRows((prev) => [...prev, ...next]);
        if (!originTouched) {
          const majority = majorityProvider(result.rows);
          if (majority) {
            setOriginProvider(majority);
          }
        }
        setStep("review");
      } finally {
        setBusyKey(null);
      }
    });
  };

  const onCommit = () => {
    setMessage(null);
    setBusyKey("commit");
    startTransition(async () => {
      try {
        const batch = { originProvider, originLabel, originVersion };
        const items: CommitImportItem[] = [];
        for (const row of rows) {
          if (!archiveReady(row)) {
            continue;
          }
          const origin = resolveRowOrigin(row, batch);
          if (row.status === "ready_full" && row.invoice) {
            items.push({
              fileName: row.fileName,
              pdfUrl: row.pdfUrl,
              isdocXml: row.isdocXml,
              completeness: "full",
              invoice: row.invoice,
              externalKey:
                row.externalKey ??
                buildExternalKey({
                  provider: origin.provider,
                  number: row.invoice.meta.number,
                  issueDate: row.invoice.meta.issueDate,
                }),
              origin,
              paid: row.paid,
              paidAt: row.invoice.meta.issueDate,
            });
          } else if (row.archive) {
            const due = row.archive.meta.dueDate || row.archive.meta.issueDate;
            items.push({
              fileName: row.fileName,
              pdfUrl: row.pdfUrl,
              completeness: "archive",
              archive: {
                ...row.archive,
                meta: {
                  ...row.archive.meta,
                  dueDate: due,
                  duzp: row.archive.meta.duzp || row.archive.meta.issueDate,
                },
              },
              externalKey:
                row.externalKey ??
                buildExternalKey({
                  provider: origin.provider,
                  number: row.archive.meta.number,
                  issueDate: row.archive.meta.issueDate,
                }),
              origin,
              paid: row.paid,
              paidAt: row.archive.meta.issueDate,
            });
          }
        }

        const result = await commitInvoiceImport({
          issuerId,
          originProvider,
          originLabel: originLabel || undefined,
          originVersion: originVersion || undefined,
          defaultPaid,
          items,
        });
        setMessage(
          `Import hotov: ${result.created} vytvořeno, ${result.skipped} přeskočeno, ${result.failed} chyb.`,
        );
        if (result.created > 0) {
          router.push(
            `/invoices?toast=import&ok=${result.created}&skipped=${result.skipped}&failed=${result.failed}`,
          );
          router.refresh();
        }
      } finally {
        setBusyKey(null);
      }
    });
  };

  if (issuers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nejprve vytvořte{" "}
        <Link className="underline" href="/issuers">
          dodavatele
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Kroky importu" className="flex flex-wrap gap-2">
        {STEPS.map((s, index) => {
          const active = step === s.id;
          const done =
            (s.id === "settings" && step !== "settings") ||
            (s.id === "upload" && step === "review");
          return (
            <button
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                active && "border-foreground bg-muted font-medium",
                !active && done && "text-foreground",
                !active && !done && "text-muted-foreground",
              )}
              key={s.id}
              onClick={() => {
                if (s.id === "review" && rows.length === 0) {
                  return;
                }
                setStep(s.id);
              }}
              type="button"
            >
              <span className="text-muted-foreground mr-1.5 tabular-nums">
                {index + 1}.
              </span>
              {s.label}
            </button>
          );
        })}
      </nav>

      {step === "settings" ? (
        <div className="space-y-4">
          <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issuerId">Dodavatel (vystavitel)</Label>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                id="issuerId"
                onChange={(e) => setIssuerId(e.target.value)}
                value={issuerId}
              >
                {issuers.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="originProvider">
                Výchozí zdroj (pro nerozpoznané)
              </Label>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                id="originProvider"
                onChange={(e) => {
                  setOriginTouched(true);
                  setOriginProvider(e.target.value as InvoiceOriginProvider);
                }}
                value={originProvider}
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {ORIGIN_PROVIDER_LABELS[p]}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                Po nahrání se u každého PDF použije detekovaný zdroj; tento
                výběr je záloha a hromadná úprava.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="originVersion">Verze (volitelné)</Label>
              <Input
                id="originVersion"
                onChange={(e) => setOriginVersion(e.target.value)}
                placeholder="např. 0.4.0"
                value={originVersion}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="originLabel">Vlastní popisek (volitelné)</Label>
              <Input
                id="originLabel"
                onChange={(e) => setOriginLabel(e.target.value)}
                placeholder="např. stará šablona ve Wordu"
                value={originLabel}
              />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <Checkbox
                checked={defaultPaid}
                onCheckedChange={(v) => setDefaultPaid(v === true)}
              />
              Výchozí: označit importované jako zaplacené
            </label>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep("upload")} type="button">
              Pokračovat k nahrání
            </Button>
          </div>
        </div>
      ) : null}

      {step === "upload" ? (
        <div className="space-y-4">
          <div className="rounded-md border p-4">
            <p className="mb-3 text-sm font-medium">
              Nahrajte PDF faktury (až 40 najednou)
            </p>
            <UploadDropzone
              endpoint="importedInvoicePdf"
              onClientUploadComplete={(res) => {
                if (!res?.length) {
                  return;
                }
                onUploaded(
                  res.map((f) => ({
                    name: f.name,
                    ufsUrl: f.ufsUrl,
                  })),
                );
              }}
              onUploadError={(err) => setMessage(err.message)}
            />
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              onClick={() => setStep("settings")}
              type="button"
              variant="outline"
            >
              Zpět
            </Button>
            {rows.length > 0 ? (
              <Button onClick={() => setStep("review")} type="button">
                Ke kontrole ({rows.length})
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              K importu připraveno: {readyCount} / {rows.length}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={rows.length === 0}
                onClick={applyOriginToAll}
                type="button"
                variant="outline"
              >
                Použít výchozí zdroj na všechny
              </Button>
              <Button
                disabled={pending || readyCount === 0}
                loading={busyKey === "commit"}
                onClick={onCommit}
              >
                {busyKey === "commit"
                  ? "Importuji…"
                  : `Importovat ${readyCount} faktur`}
              </Button>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Zatím žádné soubory.{" "}
              <button
                className="underline"
                onClick={() => setStep("upload")}
                type="button"
              >
                Nahrajte PDF
              </button>
              .
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Soubor</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead>Zdroj</TableHead>
                    <TableHead>Číslo</TableHead>
                    <TableHead>Klient</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Celkem</TableHead>
                    <TableHead>Zaplaceno</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={`${row.pdfUrl}-${index}`}>
                      <TableCell className="max-w-[10rem] truncate text-xs">
                        {row.fileName}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.status === "ready_full"
                          ? "ISDOC"
                          : row.status === "needs_archive_fields"
                            ? "Archiv"
                            : `Chyba: ${row.error ?? "?"}`}
                      </TableCell>
                      <TableCell>
                        <select
                          className="border-input bg-background h-8 max-w-[10rem] rounded-md border px-2 text-xs"
                          onChange={(e) =>
                            updateRow(index, {
                              originProvider: e.target
                                .value as InvoiceOriginProvider,
                            })
                          }
                          value={row.originProvider}
                        >
                          {PROVIDERS.map((p) => (
                            <option key={p} value={p}>
                              {ORIGIN_PROVIDER_LABELS[p]}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        {row.invoice ? (
                          <span className="text-sm">
                            {row.invoice.meta.number}
                          </span>
                        ) : (
                          <Input
                            className="h-8 w-28"
                            onChange={(e) =>
                              updateArchiveField(index, (a) => {
                                a.meta.number = e.target.value;
                              })
                            }
                            placeholder="číslo"
                            value={row.archive?.meta.number ?? ""}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {row.invoice ? (
                          <span className="text-sm">
                            {row.invoice.client.name}
                          </span>
                        ) : (
                          <Input
                            className="h-8 w-36"
                            onChange={(e) =>
                              updateArchiveField(index, (a) => {
                                a.client.name = e.target.value;
                              })
                            }
                            placeholder="odběratel"
                            value={row.archive?.client.name ?? ""}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {row.invoice ? (
                          <span className="text-sm">
                            {row.invoice.meta.issueDate}
                          </span>
                        ) : (
                          <Input
                            className="h-8 w-32"
                            onChange={(e) =>
                              updateArchiveField(index, (a) => {
                                a.meta.issueDate = e.target.value;
                                if (!a.meta.dueDate) {
                                  a.meta.dueDate = e.target.value;
                                }
                              })
                            }
                            type="date"
                            value={row.archive?.meta.issueDate ?? ""}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {row.invoice ? (
                          <span className="text-sm">
                            {row.invoice.totals.total.toFixed(2)}
                          </span>
                        ) : (
                          <Input
                            className="h-8 w-24"
                            onChange={(e) =>
                              updateArchiveField(index, (a) => {
                                const total = Number(e.target.value);
                                a.totals.total = Number.isFinite(total)
                                  ? total
                                  : 0;
                                a.totals.subtotal = a.totals.total;
                                a.totals.vatTotal = 0;
                              })
                            }
                            placeholder="0"
                            type="number"
                            value={row.archive?.totals.total || ""}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={row.paid}
                          onCheckedChange={(v) =>
                            updateRow(index, { paid: v === true })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {rows.some((r) => r.status === "needs_archive_fields") ? (
            <p className="text-muted-foreground text-xs">
              Řádky bez ISDOC: doplňte číslo, odběratele, datum a částku. Uloží
              se originální PDF (archiv).
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setStep("upload")}
              type="button"
              variant="outline"
            >
              Přidat další PDF
            </Button>
            <Button
              onClick={() => setStep("settings")}
              type="button"
              variant="ghost"
            >
              Upravit nastavení
            </Button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="text-muted-foreground text-sm">{message}</p>
      ) : null}
      {pending ? (
        <p className="text-muted-foreground text-sm">
          {busyKey === "commit" ? "Importuji…" : "Pracuji…"}
        </p>
      ) : null}
    </div>
  );
}
