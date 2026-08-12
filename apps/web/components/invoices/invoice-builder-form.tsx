"use client";

import { issueInvoice, saveInvoiceDraft } from "@/actions/invoices";
import {
  collectFormErrorMessages,
  Field,
  selectClassName,
} from "@/components/invoices/field";
import { InvoicePdfPreview } from "@/components/invoices/invoice-pdf-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addDaysIso,
  todayIsoDate,
  tryBuildInvoicePayload,
  type BuilderLineInput,
} from "@/lib/build-invoice";
import { formatMoney } from "@/lib/format";
import type { ClientOption, IssuerOption } from "@/lib/invoice-party-types";
import { cn } from "@/lib/utils";
import { nextInvoiceNumber } from "@invoicey/invoice-core/numbering";
import type { Invoice } from "@invoicey/invoice-core/schema";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import * as React from "react";
import {
  useFieldArray,
  useForm,
  type FieldErrors,
  type FieldPath,
} from "react-hook-form";
import { z } from "zod";
import { useTranslations, useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { lookupMessageFromInvalid } from "@/components/issuers/issuer-form-shared";

const STANDARD_VAT_RATES = [0, 12, 21] as const;

function createBuilderFormSchema(t: (key: string) => string) {
  const isoDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, t("errors.invalidDate"));
  return z
    .object({
      issuerId: z.string().uuid(t("errors.selectIssuer")),
      clientId: z.string().uuid(t("errors.selectClient")),
      docType: z.enum(["invoice", "proforma", "advance", "credit_note"]),
      issueDate: isoDate,
      dueDate: isoDate,
      duzp: isoDate,
      currency: z.enum(["CZK", "EUR", "USD"]),
      language: z.enum(["cs", "en"]),
      vatMode: z.enum(["regular", "reverse_charge", "oss"]),
      pricesIncludeVat: z.boolean(),
      suppliesAbroad: z.enum(["none", "eu", "non_eu"]),
      legalNote: z.string().optional(),
      localReverseChargeCode: z.string().optional(),
      correctedInvoiceNumber: z.string().optional(),
      notes: z.string().optional(),
      items: z
        .array(
          z.object({
            description: z.string().min(1, t("errors.descriptionRequired")),
            quantity: z
              .number({ error: t("errors.quantityRequired") })
              .refine((q) => q !== 0, t("errors.quantityZero")),
            unit: z.string().min(1, t("errors.unitRequired")),
            unitPriceWithoutVat: z
              .number({ error: t("errors.priceRequired") })
              .nonnegative(t("errors.priceNegative")),
            vatRate: z
              .number({ error: t("errors.vatRequired") })
              .min(0)
              .max(100),
          }),
        )
        .min(1, t("errors.itemsMin")),
    })
    .refine((d) => d.dueDate >= d.issueDate, {
      message: t("errors.dueBeforeIssue"),
      path: ["dueDate"],
    });
}

type BuilderFormValues = z.infer<ReturnType<typeof createBuilderFormSchema>>;

function isStandardVatRate(
  rate: number,
): rate is (typeof STANDARD_VAT_RATES)[number] {
  return (STANDARD_VAT_RATES as readonly number[]).includes(rate);
}

function defaultLineVatRate(vatPayer: boolean): number {
  return vatPayer ? 21 : 0;
}

export type { ClientOption, IssuerOption };

export interface InvoiceBuilderFormProps {
  mode: "create" | "edit";
  invoiceId?: string;
  invalidQuery?: string | null;
  issuers: IssuerOption[];
  clients: ClientOption[];
  initial?: Partial<BuilderFormValues> & { numberPreview?: string };
}

function fieldError(
  errors: FieldErrors<BuilderFormValues>,
  name: FieldPath<BuilderFormValues>,
): string | undefined {
  const parts = name.split(".");
  let node: unknown = errors;
  for (const p of parts) {
    if (node == null || typeof node !== "object") {
      return undefined;
    }
    node = (node as Record<string, unknown>)[p];
  }
  if (node && typeof node === "object" && "message" in node) {
    const msg = (node as { message?: unknown }).message;
    return typeof msg === "string" ? msg : undefined;
  }
  return undefined;
}

export function InvoiceBuilderForm({
  mode,
  invoiceId,
  invalidQuery,
  issuers,
  clients,
  initial,
}: InvoiceBuilderFormProps) {
  const t = useTranslations("Invoices.builder");
  const tErr = useTranslations("Errors.invalid");
  const locale = useLocale() as AppLocale;
  const schema = React.useMemo(
    () => createBuilderFormSchema((key) => t(key as never)),
    [t],
  );
  const defaultIssue = initial?.issueDate ?? todayIsoDate();
  const firstIssuer = issuers[0];
  const initialIssuer =
    issuers.find((i) => i.id === (initial?.issuerId ?? firstIssuer?.id)) ??
    firstIssuer;
  const form = useForm<BuilderFormValues>({
    resolver: standardSchemaResolver(schema),
    mode: "onBlur",
    defaultValues: {
      issuerId: initial?.issuerId ?? firstIssuer?.id ?? "",
      clientId: initial?.clientId ?? clients[0]?.id ?? "",
      docType: initial?.docType ?? "invoice",
      issueDate: defaultIssue,
      dueDate: initial?.dueDate ?? addDaysIso(defaultIssue, 14),
      duzp: initial?.duzp ?? defaultIssue,
      currency: initial?.currency ?? "CZK",
      language: initial?.language ?? "cs",
      vatMode: initial?.vatMode ?? "regular",
      pricesIncludeVat: initial?.pricesIncludeVat ?? false,
      suppliesAbroad: initial?.suppliesAbroad ?? "none",
      legalNote: initial?.legalNote ?? "",
      localReverseChargeCode: initial?.localReverseChargeCode ?? "",
      correctedInvoiceNumber: initial?.correctedInvoiceNumber ?? "",
      notes: initial?.notes ?? "",
      items: initial?.items ?? [
        {
          description: "",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 0,
          vatRate: defaultLineVatRate(initialIssuer?.snapshot.vatPayer ?? true),
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watched = form.watch();
  const errors = form.formState.errors;
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const previewUrlRef = React.useRef<string | null>(null);
  const lastPreviewKeyRef = React.useRef<string | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [previewUpdating, setPreviewUpdating] = React.useState(false);
  const [numberPreview, setNumberPreview] = React.useState(
    initial?.numberPreview ?? "—",
  );
  const [submitting, setSubmitting] = React.useState<"draft" | "issue" | null>(
    null,
  );
  const [showAdvancedVat, setShowAdvancedVat] = React.useState(
    () => initial?.vatMode === "oss",
  );
  const [formErrorList, setFormErrorList] = React.useState<string[]>([]);
  const [customVatRateLines, setCustomVatRateLines] = React.useState<
    Record<number, boolean>
  >(() => {
    const items = initial?.items ?? [];
    const map: Record<number, boolean> = {};
    items.forEach((it, idx) => {
      if (it.vatRate != null && !isStandardVatRate(Number(it.vatRate))) {
        map[idx] = true;
      }
    });
    return map;
  });

  const selectedIssuer = issuers.find((i) => i.id === watched.issuerId);
  const issuerVatPayer = selectedIssuer?.snapshot.vatPayer ?? true;
  const hideRatePicker =
    !issuerVatPayer || watched.vatMode === "reverse_charge";

  React.useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  /** neplátce: force regular + zero rates */
  React.useEffect(() => {
    const issuer = issuers.find((i) => i.id === watched.issuerId);
    if (!issuer || issuer.snapshot.vatPayer) {
      return;
    }
    if (watched.vatMode !== "regular") {
      form.setValue("vatMode", "regular");
    }
    const items = form.getValues("items");
    let changed = false;
    const next = items.map((it) => {
      if (it.vatRate === 0) {
        return it;
      }
      changed = true;
      return { ...it, vatRate: 0 };
    });
    if (changed) {
      form.setValue("items", next);
      setCustomVatRateLines({});
    }
  }, [watched.issuerId, issuers, form, watched.vatMode]);

  /** reverse_charge: zero line rates */
  React.useEffect(() => {
    if (watched.vatMode !== "reverse_charge") {
      return;
    }
    const items = form.getValues("items");
    let changed = false;
    const next = items.map((it) => {
      if (it.vatRate === 0) {
        return it;
      }
      changed = true;
      return { ...it, vatRate: 0 };
    });
    if (changed) {
      form.setValue("items", next);
      setCustomVatRateLines({});
    }
  }, [watched.vatMode, form]);

  React.useEffect(() => {
    const issuer = issuers.find((i) => i.id === watched.issuerId);
    if (!issuer) {
      setNumberPreview("—");
      return;
    }
    const scheme = issuer.schemes.find((s) => s.docType === watched.docType);
    if (!scheme) {
      setNumberPreview(t("missingScheme"));
      return;
    }
    try {
      const n = nextInvoiceNumber(
        {
          template: scheme.template,
          counter: scheme.counter,
          counterYear: scheme.counterYear ?? undefined,
          resetPeriod: scheme.resetPeriod === "never" ? "never" : "yearly",
          padding: scheme.padding,
          docType: watched.docType,
          issuerName: issuer.snapshot.name,
        },
        new Date(`${watched.issueDate}T12:00:00.000Z`),
      );
      setNumberPreview((prev) => (prev === n ? prev : n));
    } catch {
      setNumberPreview("—");
    }
  }, [issuers, t, watched.issuerId, watched.docType, watched.issueDate]);

  const previewBuild = React.useMemo(() => {
    const issuer = issuers.find((i) => i.id === watched.issuerId)?.snapshot;
    const client = clients.find((c) => c.id === watched.clientId)?.snapshot;
    if (!issuer || !client) {
      return { invoice: null as Invoice | null, error: null as string | null };
    }
    const lines: BuilderLineInput[] = watched.items.map((it) => ({
      description: it.description || "—",
      quantity: Number(it.quantity) || 1,
      unit: it.unit || "ks",
      unitPriceWithoutVat: Number(it.unitPriceWithoutVat) || 0,
      vatRate: Number(it.vatRate) || 0,
    }));
    const built = tryBuildInvoicePayload({
      docType: watched.docType,
      number:
        numberPreview !== "—" && !numberPreview.startsWith("(")
          ? numberPreview
          : "DRAFT",
      issueDate: watched.issueDate,
      dueDate: watched.dueDate,
      duzp: watched.duzp,
      currency: watched.currency,
      language: watched.language,
      issuer,
      client,
      vatMode: watched.vatMode,
      suppliesAbroad: watched.suppliesAbroad,
      legalNote: watched.legalNote || undefined,
      localReverseChargeCode: watched.localReverseChargeCode || undefined,
      correctedInvoiceNumber: watched.correctedInvoiceNumber || undefined,
      items: lines,
      notes: watched.notes || undefined,
      pricesIncludeVat: watched.pricesIncludeVat,
    });
    if (!built.ok) {
      return { invoice: null, error: built.message };
    }
    return { invoice: built.invoice, error: null };
  }, [
    issuers,
    clients,
    numberPreview,
    watched.issuerId,
    watched.clientId,
    watched.docType,
    watched.issueDate,
    watched.dueDate,
    watched.duzp,
    watched.currency,
    watched.language,
    watched.vatMode,
    watched.pricesIncludeVat,
    watched.suppliesAbroad,
    watched.legalNote,
    watched.localReverseChargeCode,
    watched.correctedInvoiceNumber,
    watched.notes,
    watched.items,
  ]);

  const previewKey = previewBuild.invoice
    ? JSON.stringify(previewBuild.invoice)
    : null;

  React.useEffect(() => {
    if (previewBuild.error) {
      setPreviewError(previewBuild.error);
      return;
    }
    if (!previewKey || !previewBuild.invoice) {
      return;
    }
    if (previewKey === lastPreviewKeyRef.current) {
      return;
    }

    const invoice = previewBuild.invoice;
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      setPreviewUpdating(true);
      void refreshPreview(invoice, controller.signal)
        .then((url) => {
          if (controller.signal.aborted || !url) {
            return;
          }
          lastPreviewKeyRef.current = previewKey;
          if (previewUrlRef.current && previewUrlRef.current !== url) {
            URL.revokeObjectURL(previewUrlRef.current);
          }
          previewUrlRef.current = url;
          setPreviewUrl(url);
          setPreviewError(null);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) {
            return;
          }
          if (e instanceof Error && e.name === "AbortError") {
            return;
          }
          setPreviewError(e instanceof Error ? e.message : t("previewError"));
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setPreviewUpdating(false);
          }
        });
    }, 700);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [previewKey, previewBuild.error, previewBuild.invoice, t]);

  const totalsPreview = React.useMemo(() => {
    const issuer = issuers.find((i) => i.id === watched.issuerId)?.snapshot;
    const client = clients.find((c) => c.id === watched.clientId)?.snapshot;
    if (!issuer || !client) {
      return null;
    }
    const built = tryBuildInvoicePayload({
      docType: watched.docType,
      number: "DRAFT",
      issueDate: watched.issueDate,
      dueDate: watched.dueDate,
      duzp: watched.duzp,
      currency: watched.currency,
      language: watched.language,
      issuer,
      client,
      vatMode: watched.vatMode,
      suppliesAbroad: watched.suppliesAbroad,
      legalNote: watched.legalNote || undefined,
      localReverseChargeCode: watched.localReverseChargeCode || undefined,
      pricesIncludeVat: watched.pricesIncludeVat,
      items: watched.items.map((it) => ({
        description: it.description || "—",
        quantity: Number(it.quantity) || 1,
        unit: it.unit || "ks",
        unitPriceWithoutVat: Number(it.unitPriceWithoutVat) || 0,
        vatRate: Number(it.vatRate) || 0,
      })),
    });
    return built.ok ? built.invoice.totals : null;
  }, [watched, issuers, clients]);

  async function submit(action: "draft" | "issue") {
    if (submitting) {
      return;
    }
    const ok = await form.trigger();
    const values = form.getValues();
    const parsed = schema.safeParse(values);
    if (!ok || !parsed.success) {
      const msgs = collectFormErrorMessages(
        form.formState.errors as Record<string, unknown>,
      );
      if (parsed.success === false) {
        for (const issue of parsed.error.issues.slice(0, 8)) {
          const path = issue.path.join(".");
          const line = path ? `${path}: ${issue.message}` : issue.message;
          if (!msgs.includes(line)) {
            msgs.push(line);
          }
        }
      }
      setFormErrorList(msgs.length > 0 ? msgs : [t("formFallback")]);
      const firstKey = Object.keys(form.formState.errors)[0] as
        FieldPath<BuilderFormValues> | undefined;
      if (firstKey) {
        void form.setFocus(firstKey);
      }
      return;
    }
    setFormErrorList([]);
    setSubmitting(action);
    const fd = new FormData();
    if (invoiceId) {
      fd.set("id", invoiceId);
    }
    fd.set("issuerId", values.issuerId);
    fd.set("clientId", values.clientId);
    fd.set("docType", values.docType);
    fd.set("issueDate", values.issueDate);
    fd.set("dueDate", values.dueDate);
    fd.set("duzp", values.duzp);
    fd.set("currency", values.currency);
    fd.set("language", values.language);
    fd.set("vatMode", values.vatMode);
    fd.set("pricesIncludeVat", values.pricesIncludeVat ? "true" : "false");
    fd.set("suppliesAbroad", values.suppliesAbroad);
    if (values.legalNote) {
      fd.set("legalNote", values.legalNote);
    }
    if (values.localReverseChargeCode) {
      fd.set("localReverseChargeCode", values.localReverseChargeCode);
    }
    if (values.correctedInvoiceNumber) {
      fd.set("correctedInvoiceNumber", values.correctedInvoiceNumber);
    }
    if (values.notes) {
      fd.set("notes", values.notes);
    }
    fd.set("itemsJson", JSON.stringify(values.items));
    try {
      if (action === "draft") {
        await saveInvoiceDraft(fd);
      } else {
        await issueInvoice(fd);
      }
    } finally {
      setSubmitting(null);
    }
  }

  if (issuers.length === 0 || clients.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t.rich("missingParties", {
          entities: () => (
            <>
              {issuers.length === 0 ? (
                <a className="underline" href="/issuers/new">
                  {t("missingIssuer")}
                </a>
              ) : null}
              {issuers.length === 0 && clients.length === 0
                ? t("missingAnd")
                : null}
              {clients.length === 0 ? (
                <a className="underline" href="/clients/new">
                  {t("missingClient")}
                </a>
              ) : null}
            </>
          ),
        })}
      </p>
    );
  }

  const alertMessages = [
    ...(invalidQuery
      ? [lookupMessageFromInvalid(invalidQuery, tErr)].filter(
          (m): m is string => m != null,
        )
      : []),
    ...formErrorList,
  ];

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        {alertMessages.length > 0 ? (
          <div
            className="border-destructive/40 bg-destructive/10 text-destructive space-y-1 rounded-md border px-3 py-2 text-sm"
            role="alert"
          >
            <p className="font-medium">{t("formErrors")}</p>
            <ul className="list-inside list-disc text-xs">
              {alertMessages.slice(0, 8).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2">
          <Field
            description={t("issuerDescription")}
            error={fieldError(errors, "issuerId")}
            label={t("issuer")}
          >
            <select
              aria-invalid={Boolean(fieldError(errors, "issuerId"))}
              className={selectClassName(
                Boolean(fieldError(errors, "issuerId")),
              )}
              {...form.register("issuerId")}
            >
              {issuers.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.snapshot.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            description={t("clientDescription")}
            error={fieldError(errors, "clientId")}
            label={t("client")}
          >
            <select
              aria-invalid={Boolean(fieldError(errors, "clientId"))}
              className={selectClassName(
                Boolean(fieldError(errors, "clientId")),
              )}
              {...form.register("clientId")}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.snapshot.name}
                  {c.snapshot.ico
                    ? t("icoSuffix", { ico: c.snapshot.ico })
                    : ""}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Field
            description={t("docTypeDescription")}
            error={fieldError(errors, "docType")}
            label={t("docType")}
          >
            <select className={selectClassName()} {...form.register("docType")}>
              <option value="invoice">{t("docTypeInvoice")}</option>
              <option value="proforma">{t("docTypeProforma")}</option>
              <option value="advance">{t("docTypeAdvance")}</option>
              <option value="credit_note">{t("docTypeCreditNote")}</option>
            </select>
          </Field>
          <Field
            description={t("numberPreviewDescription")}
            label={t("numberPreview")}
          >
            <p className="text-sm font-medium tabular-nums">{numberPreview}</p>
          </Field>
          <Field
            description={t("issueDateDescription")}
            error={fieldError(errors, "issueDate")}
            label={t("issueDate")}
          >
            <Input
              aria-invalid={Boolean(fieldError(errors, "issueDate"))}
              type="date"
              {...form.register("issueDate")}
            />
          </Field>
          <Field
            description={t("dueDateDescription")}
            error={fieldError(errors, "dueDate")}
            label={t("dueDate")}
          >
            <Input
              aria-invalid={Boolean(fieldError(errors, "dueDate"))}
              type="date"
              {...form.register("dueDate")}
            />
          </Field>
          <Field
            description={t("duzpDescription")}
            error={fieldError(errors, "duzp")}
            label={t("duzp")}
          >
            <Input
              aria-invalid={Boolean(fieldError(errors, "duzp"))}
              type="date"
              {...form.register("duzp")}
            />
          </Field>
          <Field
            description={t("currencyDescription")}
            error={fieldError(errors, "currency")}
            label={t("currency")}
          >
            <select
              className={selectClassName()}
              {...form.register("currency")}
            >
              <option value="CZK">{t("currencyCzk")}</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <Field
            description={t("languageDescription")}
            error={fieldError(errors, "language")}
            label={t("language")}
          >
            <select
              className={selectClassName()}
              {...form.register("language")}
            >
              <option value="cs">{t("languageCs")}</option>
              <option value="en">{t("languageEn")}</option>
            </select>
          </Field>
          <Field
            description={t("vatModeDescription")}
            error={fieldError(errors, "vatMode")}
            label={t("vatMode")}
          >
            <select
              className={selectClassName()}
              disabled={!issuerVatPayer}
              {...form.register("vatMode")}
            >
              <option value="regular">
                {issuerVatPayer ? t("vatRegularPayer") : t("vatNonPayer")}
              </option>
              {issuerVatPayer ? (
                <option value="reverse_charge">{t("vatReverseCharge")}</option>
              ) : null}
              {issuerVatPayer && showAdvancedVat ? (
                <option value="oss">{t("vatOss")}</option>
              ) : null}
            </select>
            {issuerVatPayer ? (
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <input
                  checked={showAdvancedVat}
                  onChange={(ev) => {
                    setShowAdvancedVat(ev.target.checked);
                    if (!ev.target.checked && watched.vatMode === "oss") {
                      form.setValue("vatMode", "regular");
                    }
                  }}
                  type="checkbox"
                />
                {t("vatAdvanced")}
              </label>
            ) : null}
          </Field>
          <Field
            description={t("suppliesAbroadDescription")}
            error={fieldError(errors, "suppliesAbroad")}
            label={t("suppliesAbroad")}
          >
            <select
              className={selectClassName()}
              {...form.register("suppliesAbroad")}
            >
              <option value="none">{t("suppliesNone")}</option>
              <option value="eu">{t("suppliesEu")}</option>
              <option value="non_eu">{t("suppliesNonEu")}</option>
            </select>
          </Field>
        </section>

        {watched.vatMode === "reverse_charge" ? (
          <section className="grid gap-4 sm:grid-cols-2">
            <Field
              description={t("legalNoteDescription")}
              error={fieldError(errors, "legalNote")}
              label={t("legalNote")}
            >
              <Input
                placeholder={t("legalNotePlaceholder")}
                {...form.register("legalNote")}
              />
            </Field>
            <Field
              description={t("reverseChargeCodeDescription")}
              error={fieldError(errors, "localReverseChargeCode")}
              label={t("reverseChargeCode")}
            >
              <Input
                placeholder={t("reverseChargeCodePlaceholder")}
                {...form.register("localReverseChargeCode")}
              />
            </Field>
          </section>
        ) : null}

        {watched.docType === "credit_note" ? (
          <Field
            description={t("correctedInvoiceDescription")}
            error={fieldError(errors, "correctedInvoiceNumber")}
            label={t("correctedInvoice")}
          >
            <Input
              placeholder="20260001"
              {...form.register("correctedInvoiceNumber")}
            />
          </Field>
        ) : null}

        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-medium">{t("itemsTitle")}</h2>
              <p className="text-muted-foreground text-xs">
                {watched.pricesIncludeVat
                  ? t("itemsDescriptionIncl")
                  : t("itemsDescription")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label={t("pricesModeAria")}
                className={selectClassName()}
                onChange={(ev) => {
                  form.setValue("pricesIncludeVat", ev.target.value === "incl");
                }}
                value={watched.pricesIncludeVat ? "incl" : "excl"}
              >
                <option value="excl">{t("pricesExcl")}</option>
                <option value="incl">{t("pricesIncl")}</option>
              </select>
              <Button
                onClick={() => {
                  append({
                    description: "",
                    quantity: 1,
                    unit: "ks",
                    unitPriceWithoutVat: 0,
                    vatRate: hideRatePicker
                      ? 0
                      : defaultLineVatRate(issuerVatPayer),
                  });
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                {t("addRow")}
              </Button>
            </div>
          </div>
          {fieldError(errors, "items") ? (
            <p className="text-destructive text-xs">
              {fieldError(errors, "items")}
            </p>
          ) : null}
          {fields.map((field, index) => {
            const line = watched.items[index];
            const qty = Number(line?.quantity) || 0;
            const unitPrice = Number(line?.unitPriceWithoutVat) || 0;
            const rate = Number(line?.vatRate) || 0;
            const lineTotal = watched.pricesIncludeVat
              ? qty * unitPrice
              : qty * unitPrice * (1 + rate / 100);
            const descErr = fieldError(
              errors,
              `items.${index}.description` as FieldPath<BuilderFormValues>,
            );
            const showCustomRate =
              customVatRateLines[index] === true ||
              (line?.vatRate != null &&
                !isStandardVatRate(Number(line.vatRate)));
            return (
              <div
                className={cn(
                  "grid gap-2 rounded-md border p-3 sm:grid-cols-6",
                  (descErr ||
                    fieldError(
                      errors,
                      `items.${index}.quantity` as FieldPath<BuilderFormValues>,
                    )) &&
                    "border-destructive/50",
                )}
                key={field.id}
              >
                <div className="space-y-1 sm:col-span-2">
                  <Input
                    aria-label={t("itemDescriptionAria", {
                      n: String(index + 1),
                    })}
                    aria-invalid={Boolean(descErr)}
                    placeholder={t("descriptionPlaceholder")}
                    {...form.register(`items.${index}.description`)}
                  />
                  {descErr ? (
                    <p className="text-destructive text-xs">{descErr}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Input
                    aria-label={t("itemQuantityAria", { n: String(index + 1) })}
                    aria-invalid={Boolean(
                      fieldError(
                        errors,
                        `items.${index}.quantity` as FieldPath<BuilderFormValues>,
                      ),
                    )}
                    placeholder={t("quantityPlaceholder")}
                    step="any"
                    type="number"
                    {...form.register(`items.${index}.quantity`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="space-y-1">
                  <Input
                    aria-label={t("itemUnitAria", { n: String(index + 1) })}
                    placeholder={t("unitPlaceholder")}
                    {...form.register(`items.${index}.unit`)}
                  />
                </div>
                <div className="space-y-1">
                  <Input
                    aria-label={
                      watched.pricesIncludeVat
                        ? t("itemPriceInclAria", { n: String(index + 1) })
                        : t("itemPriceExclAria", { n: String(index + 1) })
                    }
                    placeholder={
                      watched.pricesIncludeVat
                        ? t("priceInclPlaceholder")
                        : t("pricePlaceholder")
                    }
                    step="any"
                    type="number"
                    {...form.register(`items.${index}.unitPriceWithoutVat`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex gap-1">
                    {hideRatePicker ? (
                      <>
                        <Input
                          aria-label={t("itemVatAria", {
                            n: String(index + 1),
                          })}
                          disabled
                          readOnly
                          value="0 %"
                        />
                        <input
                          type="hidden"
                          {...form.register(`items.${index}.vatRate`, {
                            valueAsNumber: true,
                          })}
                        />
                      </>
                    ) : (
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <select
                          aria-label={t("itemVatAria", {
                            n: String(index + 1),
                          })}
                          className={selectClassName()}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            if (v === "other") {
                              setCustomVatRateLines((prev) => ({
                                ...prev,
                                [index]: true,
                              }));
                              return;
                            }
                            setCustomVatRateLines((prev) => {
                              const next = { ...prev };
                              delete next[index];
                              return next;
                            });
                            form.setValue(`items.${index}.vatRate`, Number(v), {
                              shouldValidate: true,
                            });
                          }}
                          value={
                            showCustomRate
                              ? "other"
                              : String(isStandardVatRate(rate) ? rate : 21)
                          }
                        >
                          <option value="0">0 %</option>
                          <option value="12">12 %</option>
                          <option value="21">21 %</option>
                          <option value="other">{t("vatOther")}</option>
                        </select>
                        {showCustomRate ? (
                          <Input
                            aria-label={t("itemVatCustomAria", {
                              n: String(index + 1),
                            })}
                            placeholder="%"
                            step="1"
                            type="number"
                            {...form.register(`items.${index}.vatRate`, {
                              valueAsNumber: true,
                            })}
                          />
                        ) : (
                          <input
                            type="hidden"
                            {...form.register(`items.${index}.vatRate`, {
                              valueAsNumber: true,
                            })}
                          />
                        )}
                      </div>
                    )}
                    <Button
                      aria-label={t("removeItem", { n: String(index + 1) })}
                      onClick={() => {
                        if (fields.length > 1) {
                          remove(index);
                        }
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <span aria-hidden="true">×</span>
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatMoney(lineTotal, watched.currency, locale)}
                  </p>
                </div>
              </div>
            );
          })}
          {totalsPreview ? (
            <p className="text-sm font-medium tabular-nums">
              {t("totalLine", {
                total: formatMoney(
                  totalsPreview.total,
                  watched.currency,
                  locale,
                ),
                vat: formatMoney(
                  totalsPreview.vatTotal,
                  watched.currency,
                  locale,
                ),
              })}
            </p>
          ) : null}
        </section>

        <Field
          description={t("notesDescription")}
          error={fieldError(errors, "notes")}
          label={t("notes")}
        >
          <Input
            placeholder={t("notesPlaceholder")}
            {...form.register("notes")}
          />
        </Field>

        <div className="bg-background/95 sticky bottom-0 z-20 -mx-4 flex flex-wrap gap-2 border-t px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button
            disabled={submitting !== null}
            loading={submitting === "draft"}
            onClick={() => void submit("draft")}
            type="button"
            variant="outline"
          >
            {submitting === "draft" ? t("savingDraft") : t("saveDraft")}
          </Button>
          <Button
            disabled={submitting !== null}
            loading={submitting === "issue"}
            onClick={() => void submit("issue")}
            type="button"
          >
            {submitting === "issue" ? t("issuing") : t("issue")}
          </Button>
          <span className="text-muted-foreground self-center text-xs">
            {mode === "edit" ? t("modeEdit") : t("modeCreate")}
          </span>
        </div>
      </form>

      <InvoicePdfPreview
        error={previewError}
        updating={previewUpdating}
        url={previewUrl}
      />
    </div>
  );
}

async function refreshPreview(
  invoice: Invoice,
  signal: AbortSignal,
): Promise<string | null> {
  const res = await fetch("/api/demo/invoice-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invoice),
    signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      issues?: {
        formErrors?: string[];
        fieldErrors?: Record<string, string[] | undefined>;
      };
    } | null;
    const parts: string[] = [];
    if (body?.error) {
      parts.push(body.error);
    }
    if (body?.issues?.formErrors?.length) {
      parts.push(...body.issues.formErrors);
    }
    if (body?.issues?.fieldErrors) {
      for (const [k, msgs] of Object.entries(body.issues.fieldErrors)) {
        if (msgs?.length) {
          parts.push(`${k}: ${msgs.join(", ")}`);
        }
      }
    }
    throw new Error(parts.join(" · ") || `preview ${res.status}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
