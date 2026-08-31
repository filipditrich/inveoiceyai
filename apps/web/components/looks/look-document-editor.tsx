"use client";

import {
  LOOK_BLOCKS,
  LookDocumentSchema,
  lookContentEquals,
  validateLookDocument,
  type LookBand,
  type LookBlockId,
  type LookDocument,
  type LookTheme,
} from "@invoicey/invoice-core/looks";
import { InvoiceSchema, type Invoice } from "@invoicey/invoice-core/schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  publishWorkspaceLookAction,
  saveWorkspaceLookAction,
  unpublishWorkspaceLookAction,
} from "@/actions/workspace-looks";
import { selectClassName } from "@/components/invoices/field";
import { InvoicePdfPreview } from "@/components/invoices/invoice-pdf-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import sampleInvoice from "@/lib/demo-sample-invoice.json";
import { cn } from "@/lib/utils";

const BLOCKS = LOOK_BLOCKS.filter((block) => block !== "footer");

function cloneLook(look: LookDocument): LookDocument {
  return structuredClone(look);
}

function previewInvoice(look: LookDocument): Invoice | null {
  const parsed = InvoiceSchema.safeParse({
    ...sampleInvoice,
    look: { id: look.id, version: look.version },
    lookSnapshot: look,
  });
  return parsed.success ? parsed.data : null;
}

export function LookDocumentEditor({
  initial,
  published,
}: {
  initial: LookDocument;
  published: boolean;
}) {
  const t = useTranslations("App.settings.workspace.looks");
  const tErrors = useTranslations("App.workspaceErrors");
  const router = useRouter();
  const [look, setLook] = useState(() => cloneLook(initial));
  const [saved, setSaved] = useState(() => cloneLook(initial));
  const [view, setView] = useState<"structure" | "json" | "preview">(
    "structure",
  );
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(initial, null, 2),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingKind, setPendingKind] = useState<
    "save" | "publish" | "unpublish"
  >("save");
  const [isPublished, setIsPublished] = useState(published);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const issues = useMemo(() => validateLookDocument(look), [look]);
  const dirty = !lookContentEquals(look, saved);
  const previewable = useMemo(() => previewInvoice(look), [look]);
  const previewError = previewable ? fetchError : t("previewInvalid");

  const commitLook = (next: LookDocument) => {
    setLook(next);
    setJsonText(JSON.stringify(next, null, 2));
    setJsonError(null);
  };

  useEffect(() => {
    if (!previewable) return;
    const invoice = previewable;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/demo/invoice-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(invoice),
            signal: controller.signal,
          });
          if (!res.ok) {
            throw new Error(`preview ${String(res.status)}`);
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = url;
          setPreviewUrl(url);
          setFetchError(null);
        } catch (error) {
          if (controller.signal.aborted) return;
          setFetchError(
            error instanceof Error ? error.message : t("previewInvalid"),
          );
        }
      })();
    }, 400);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [previewable, t]);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const applyJson = () => {
    try {
      const parsed = LookDocumentSchema.safeParse(JSON.parse(jsonText));
      if (!parsed.success) {
        setJsonError(t("jsonInvalid"));
        return;
      }
      if (parsed.data.id !== look.id) {
        setJsonError(t("jsonMustKeepId"));
        return;
      }
      const next = {
        ...parsed.data,
        origin: "workspace" as const,
        id: look.id,
      };
      const nextIssues = validateLookDocument(next);
      if (nextIssues.length > 0) {
        setJsonError(nextIssues[0]?.message ?? t("jsonInvalid"));
        return;
      }
      commitLook(next);
    } catch {
      setJsonError(t("jsonInvalid"));
    }
  };

  const save = () => {
    setPendingKind("save");
    startTransition(async () => {
      const result = await saveWorkspaceLookAction({ look });
      if (!result.ok) {
        toast.error(tErrors(result.errorCode));
        return;
      }
      commitLook(result.look);
      setSaved(cloneLook(result.look));
      if (result.look.version !== saved.version) {
        setIsPublished(false);
      }
      toast.success(t("saved", { version: result.look.version }));
      router.refresh();
    });
  };

  const publish = () => {
    setPendingKind("publish");
    startTransition(async () => {
      const result = await publishWorkspaceLookAction({
        lookId: saved.id,
        version: saved.version,
      });
      if (!result.ok) {
        toast.error(tErrors(result.errorCode));
        return;
      }
      setIsPublished(true);
      toast.success(t("published"));
      router.refresh();
    });
  };

  const unpublish = () => {
    setPendingKind("unpublish");
    startTransition(async () => {
      const result = await unpublishWorkspaceLookAction({ lookId: saved.id });
      if (!result.ok) {
        toast.error(tErrors(result.errorCode));
        return;
      }
      setIsPublished(false);
      toast.success(t("unpublished"));
      router.refresh();
    });
  };

  const preview = (
    <InvoicePdfPreview
      className="w-full"
      error={previewError}
      url={previewUrl}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {t("currentVersion", { version: saved.version })}
        </Badge>
        {dirty ? (
          <span className="text-muted-foreground text-xs">{t("unsaved")}</span>
        ) : isPublished ? (
          <Badge variant="outline">{t("publishedBadge")}</Badge>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          {isPublished ? (
            <Button
              disabled={pending || dirty}
              onClick={unpublish}
              type="button"
              variant="outline"
            >
              {pending && pendingKind === "unpublish"
                ? t("unpublishing")
                : t("unpublish")}
            </Button>
          ) : (
            <Button
              disabled={pending || dirty || issues.length > 0}
              onClick={publish}
              type="button"
              variant="outline"
            >
              {pending && pendingKind === "publish"
                ? t("publishing")
                : t("publish")}
            </Button>
          )}
          <Button
            disabled={pending || issues.length > 0 || !dirty}
            onClick={save}
            type="button"
          >
            {pending && pendingKind === "save" ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
      {issues.length > 0 ? (
        <ul className="text-destructive list-disc space-y-1 pl-5 text-sm">
          {issues.map((issue) => (
            <li key={`${issue.path}:${issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] lg:items-start lg:gap-6">
        <Tabs
          className="min-w-0"
          onValueChange={(next) => {
            if (next === "structure" || next === "json" || next === "preview") {
              setView(next);
            }
          }}
          value={view}
        >
          <TabsList>
            <TabsTrigger value="structure">{t("viewStructure")}</TabsTrigger>
            <TabsTrigger value="json">{t("viewJson")}</TabsTrigger>
            <TabsTrigger className="lg:hidden" value="preview">
              {t("viewPreview")}
            </TabsTrigger>
          </TabsList>
          <TabsContent className="pt-4" value="structure">
            <StructureEditor look={look} onChange={commitLook} />
          </TabsContent>
          <TabsContent className="pt-4" value="json">
            <div className="space-y-2">
              <Textarea
                className="min-h-96 font-mono text-xs"
                onChange={(event) => setJsonText(event.target.value)}
                value={jsonText}
              />
              {jsonError ? (
                <p className="text-destructive text-sm">{jsonError}</p>
              ) : null}
              <Button onClick={applyJson} type="button" variant="outline">
                {t("applyJson")}
              </Button>
            </div>
          </TabsContent>
          <TabsContent className="pt-4 lg:hidden" value="preview">
            {preview}
          </TabsContent>
        </Tabs>
        <div className="hidden lg:sticky lg:top-24 lg:block">
          <p className="text-muted-foreground mb-2 text-xs">
            {t("viewPreview")}
          </p>
          {preview}
        </div>
      </div>
    </div>
  );
}

function StructureEditor({
  look,
  onChange,
}: {
  look: LookDocument;
  onChange: (look: LookDocument) => void;
}) {
  const t = useTranslations("App.settings.workspace.looks");
  const updateTheme = (patch: Partial<LookTheme>) => {
    onChange({ ...look, theme: { ...look.theme, ...patch } });
  };
  const updateBands = (bands: LookBand[]) => {
    onChange({ ...look, layout: { bands } });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="look-name">{t("name")}</Label>
          <Input
            id="look-name"
            maxLength={80}
            onChange={(event) =>
              onChange({ ...look, name: event.target.value })
            }
            value={look.name}
          />
        </div>
        <div className="space-y-1">
          <Label>{t("slug")}</Label>
          <Input disabled readOnly value={look.id} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["paper", look.theme.paper],
            ["ink", look.theme.ink],
            ["muted", look.theme.muted],
            ["line", look.theme.line],
            ["accent", look.theme.accent],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`theme-${key}`}>{t(`theme.${key}`)}</Label>
            <div className="flex gap-2">
              <Input
                aria-label={t(`theme.${key}`)}
                className="h-9 w-12 shrink-0 cursor-pointer p-1"
                id={`theme-${key}`}
                onChange={(event) => updateTheme({ [key]: event.target.value })}
                type="color"
                value={value}
              />
              <Input
                className="font-mono"
                defaultValue={value}
                key={value}
                onBlur={(event) => {
                  const next = event.target.value.trim();
                  if (/^#[0-9a-fA-F]{6}$/u.test(next)) {
                    updateTheme({ [key]: next.toLowerCase() });
                  }
                }}
                spellCheck={false}
              />
            </div>
          </div>
        ))}
        <div className="space-y-1">
          <Label htmlFor="type-scale">{t("theme.typeScale")}</Label>
          <select
            className={selectClassName()}
            id="type-scale"
            onChange={(event) =>
              updateTheme({
                typeScale: event.target.value as LookTheme["typeScale"],
              })
            }
            value={look.theme.typeScale}
          >
            <option value="sm">sm</option>
            <option value="md">md</option>
            <option value="lg">lg</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="density">{t("theme.density")}</Label>
          <select
            className={selectClassName()}
            id="density"
            onChange={(event) =>
              updateTheme({
                density: event.target.value as LookTheme["density"],
              })
            }
            value={look.theme.density}
          >
            <option value="comfortable">comfortable</option>
            <option value="compact">compact</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="logo-max">{t("theme.logoMaxHeightPt")}</Label>
          <Input
            id="logo-max"
            max={96}
            min={24}
            onChange={(event) =>
              updateTheme({ logoMaxHeightPt: Number(event.target.value) || 40 })
            }
            type="number"
            value={look.theme.logoMaxHeightPt}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="stamp-max">{t("theme.stampMaxHeightPt")}</Label>
          <Input
            id="stamp-max"
            max={200}
            min={24}
            onChange={(event) =>
              updateTheme({
                stampMaxHeightPt: Number(event.target.value) || 88,
              })
            }
            type="number"
            value={look.theme.stampMaxHeightPt}
          />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["showStamp", look.theme.showStamp],
            ["showSignature", look.theme.showSignature],
            ["showQr", look.theme.showQr],
            ["showNotes", look.theme.showNotes],
          ] as const
        ).map(([key, value]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              checked={value}
              onChange={(event) => updateTheme({ [key]: event.target.checked })}
              type="checkbox"
            />
            {t(`theme.${key}`)}
          </label>
        ))}
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{t("bands")}</p>
          <div className="flex gap-2">
            <Button
              onClick={() =>
                updateBands(
                  insertBand(look.layout.bands, {
                    type: "stack",
                    slots: [{ block: "notes" }],
                  }),
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {t("addStack")}
            </Button>
            <Button
              onClick={() =>
                updateBands(
                  insertBand(look.layout.bands, {
                    type: "row",
                    split: "1/1",
                    start: [{ block: "stamp" }],
                    end: [{ block: "signature" }],
                  }),
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {t("addRow")}
            </Button>
          </div>
        </div>
        {look.layout.bands.map((band, index) => (
          <BandEditor
            band={band}
            index={index}
            key={`band-${String(index)}`}
            onChange={(next) => {
              const bands = [...look.layout.bands];
              bands[index] = next;
              updateBands(bands);
            }}
            onMove={(dir) =>
              updateBands(moveBand(look.layout.bands, index, dir))
            }
            onRemove={() =>
              updateBands(look.layout.bands.filter((_, i) => i !== index))
            }
          />
        ))}
      </div>
    </div>
  );
}

function insertBand(bands: LookBand[], band: LookBand): LookBand[] {
  const footerAt = bands.findIndex((item) => item.type === "footer");
  if (footerAt < 0) return [...bands, band];
  return [...bands.slice(0, footerAt), band, ...bands.slice(footerAt)];
}

function moveBand(bands: LookBand[], index: number, dir: -1 | 1): LookBand[] {
  const band = bands[index];
  if (!band || band.type === "footer") return bands;
  const target = index + dir;
  const other = bands[target];
  if (!other || other.type === "footer" || target < 0) return bands;
  const next = [...bands];
  next[index] = other;
  next[target] = band;
  return next;
}

function BandEditor({
  band,
  index,
  onChange,
  onMove,
  onRemove,
}: {
  band: LookBand;
  index: number;
  onChange: (band: LookBand) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("App.settings.workspace.looks");
  const locked = band.type === "footer";
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">
          {t("bandN", { n: String(index + 1) })} · {band.type}
        </p>
        {band.type === "row" ? (
          <select
            className={cn(selectClassName(), "h-8 text-xs")}
            disabled={locked}
            onChange={(event) =>
              onChange({
                ...band,
                split: event.target.value as "1/1" | "1/2" | "2/1",
              })
            }
            value={band.split}
          >
            <option value="1/1">1/1</option>
            <option value="1/2">1/2</option>
            <option value="2/1">2/1</option>
          </select>
        ) : null}
        <div className="ml-auto flex gap-1">
          <Button
            disabled={locked}
            onClick={() => onMove(-1)}
            size="sm"
            type="button"
            variant="ghost"
          >
            ↑
          </Button>
          <Button
            disabled={locked}
            onClick={() => onMove(1)}
            size="sm"
            type="button"
            variant="ghost"
          >
            ↓
          </Button>
          <Button
            disabled={locked}
            onClick={onRemove}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("remove")}
          </Button>
        </div>
      </div>
      {band.type === "stack" || band.type === "footer" ? (
        <SlotList
          disabled={locked}
          onChange={(slots) =>
            onChange(
              band.type === "footer"
                ? band
                : { ...band, slots: slots.length > 0 ? slots : band.slots },
            )
          }
          slots={band.slots}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <SlotList
            onChange={(slots) =>
              onChange({
                ...band,
                start: slots.length > 0 ? slots : band.start,
              })
            }
            slots={band.start}
          />
          <SlotList
            onChange={(slots) =>
              onChange({
                ...band,
                end: slots.length > 0 ? slots : band.end,
              })
            }
            slots={band.end}
          />
        </div>
      )}
    </div>
  );
}

function SlotList({
  slots,
  onChange,
  disabled = false,
}: {
  slots: { block: LookBlockId; variant?: "full" | "compact" }[];
  onChange: (
    slots: { block: LookBlockId; variant?: "full" | "compact" }[],
  ) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("App.settings.workspace.looks");
  const unused = BLOCKS.filter(
    (block) => !slots.some((slot) => slot.block === block),
  );
  return (
    <div className="space-y-2">
      {slots.map((slot, index) => (
        <div key={`${slot.block}-${String(index)}`} className="flex gap-2">
          <select
            className={cn(selectClassName(), "h-8 flex-1 text-xs")}
            disabled={disabled}
            onChange={(event) => {
              const next = [...slots];
              next[index] = {
                ...slot,
                block: event.target.value as LookBlockId,
              };
              onChange(next);
            }}
            value={slot.block}
          >
            {LOOK_BLOCKS.map((block) => (
              <option key={block} value={block}>
                {block}
              </option>
            ))}
          </select>
          {slot.block === "payment" ? (
            <select
              className={cn(selectClassName(), "h-8 w-auto text-xs")}
              disabled={disabled}
              onChange={(event) => {
                const next = [...slots];
                const variant = event.target.value as "full" | "compact";
                next[index] = {
                  block: "payment",
                  variant: variant === "full" ? undefined : variant,
                };
                onChange(next);
              }}
              value={slot.variant ?? "full"}
            >
              <option value="full">full</option>
              <option value="compact">compact</option>
            </select>
          ) : null}
          <Button
            disabled={disabled || slots.length < 2}
            onClick={() => onChange(slots.filter((_, i) => i !== index))}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("remove")}
          </Button>
        </div>
      ))}
      {!disabled && unused[0] ? (
        <Button
          onClick={() => onChange([...slots, { block: unused[0]! }])}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("addBlock")}
        </Button>
      ) : null}
    </div>
  );
}
