"use client";

import {
  getLastInvoiceSuggestionsAction,
  issueInvoice,
  saveInvoiceDraft,
} from "@/actions/invoices";
import { createClientFromAres } from "@/actions/clients";
import {
  collectFormErrorMessages,
  Field,
  selectClassName,
} from "@/components/invoices/field";
import { InvoicePdfPreview } from "@/components/invoices/invoice-pdf-preview";
import { LastValueHint } from "@/components/invoices/last-value-hint";
import { lookupMessageFromInvalid } from "@/components/issuers/issuer-form-shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addDaysIso,
  diffDaysIso,
  todayIsoDate,
  tryBuildInvoicePayload,
  type BuilderLineInput,
} from "@/lib/build-invoice";
import { formatMoney } from "@/lib/format";
import type { ClientOption, IssuerOption } from "@/lib/invoice-party-types";
import {
  truncateHint,
  type LastInvoiceSuggestions,
} from "@/lib/last-invoice-suggestions";
import type { AppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { nextInvoiceNumber } from "@invoicey/invoice-core/numbering";
import type { Invoice } from "@invoicey/invoice-core/schema";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  ExternalLinkIcon,
  FileCheck2Icon,
  FileTextIcon,
  ListChecksIcon,
  MessageSquareTextIcon,
  PercentIcon,
  PlusIcon,
  SearchIcon,
  SaveIcon,
  Settings2Icon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import {
  useFieldArray,
  useForm,
  type FieldErrors,
  type FieldPath,
} from "react-hook-form";
import { z } from "zod";
import { useTranslations, useLocale } from "next-intl";

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

function FormSection({
  title,
  description,
  icon,
  action,
  children,
  footer,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className={description ? "border-b" : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4">
                {icon}
              </span>
            ) : null}
            <div className="space-y-1">
              <CardTitle>{title}</CardTitle>
              {description ? (
                <CardDescription>{description}</CardDescription>
              ) : null}
            </div>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
      {footer ? (
        <CardFooter className="justify-end">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}

export type { ClientOption, IssuerOption };

export interface InvoiceBuilderFormProps {
  mode: "create" | "edit";
  invoiceId?: string;
  invalidQuery?: string | null;
  issuers: IssuerOption[];
  clients: ClientOption[];
  lastInvoice?: LastInvoiceSuggestions | null;
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
  lastInvoice: initialLastInvoice = null,
  initial,
}: InvoiceBuilderFormProps) {
  const t = useTranslations("Invoices.builder");
  const tErr = useTranslations("Errors.invalid");
  const tAres = useTranslations("Issuers.ares");
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

  const { fields, append, remove, replace } = useFieldArray({
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
  const [lastInvoice, setLastInvoice] =
    React.useState<LastInvoiceSuggestions | null>(initialLastInvoice);
  const [clientOptions, setClientOptions] =
    React.useState<ClientOption[]>(clients);
  const [clientIco, setClientIco] = React.useState("");
  const [clientLookupMessage, setClientLookupMessage] = React.useState<
    string | null
  >(null);
  const [clientLookupError, setClientLookupError] = React.useState(false);
  const [addingClient, setAddingClient] = React.useState(false);
  const skipLastFetchRef = React.useRef(true);

  const selectedIssuer = issuers.find((i) => i.id === watched.issuerId);
  const selectedClient = clientOptions.find((i) => i.id === watched.clientId);
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
    if (watched.suppliesAbroad !== "none") {
      form.setValue("suppliesAbroad", "none");
    }
    if (watched.pricesIncludeVat) {
      form.setValue("pricesIncludeVat", false);
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
  }, [
    watched.issuerId,
    issuers,
    form,
    watched.vatMode,
    watched.suppliesAbroad,
    watched.pricesIncludeVat,
  ]);

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

  React.useEffect(() => {
    if (skipLastFetchRef.current) {
      skipLastFetchRef.current = false;
      return;
    }
    const issuerId = watched.issuerId;
    const clientId = watched.clientId;
    let cancelled = false;
    void getLastInvoiceSuggestionsAction({
      issuerId,
      clientId,
      excludeId: invoiceId,
    }).then((next) => {
      if (!cancelled) {
        setLastInvoice(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [watched.issuerId, watched.clientId, invoiceId]);

  const applyLastLines = React.useCallback(
    (items: BuilderLineInput[]) => {
      if (items.length === 0) {
        return;
      }
      const nextItems = issuerVatPayer
        ? items
        : items.map((item) => ({ ...item, vatRate: 0 }));
      replace(nextItems);
      const custom: Record<number, boolean> = {};
      nextItems.forEach((it, idx) => {
        if (!isStandardVatRate(Number(it.vatRate))) {
          custom[idx] = true;
        }
      });
      setCustomVatRateLines(custom);
    },
    [issuerVatPayer, replace],
  );

  const previewBuild = React.useMemo(() => {
    const issuer = issuers.find((i) => i.id === watched.issuerId)?.snapshot;
    const client = clientOptions.find(
      (c) => c.id === watched.clientId,
    )?.snapshot;
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
    clientOptions,
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
    const client = clientOptions.find(
      (c) => c.id === watched.clientId,
    )?.snapshot;
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
  }, [watched, issuers, clientOptions]);

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

  async function addClientFromAres() {
    if (addingClient) {
      return;
    }
    setClientLookupMessage(null);
    setClientLookupError(false);
    setAddingClient(true);
    try {
      const result = await createClientFromAres(clientIco);
      if (!result.ok) {
        setClientLookupError(true);
        setClientLookupMessage(tAres(result.code));
        return;
      }
      setClientOptions((current) =>
        [
          ...current.filter((item) => item.id !== result.client.id),
          result.client,
        ].toSorted((a, b) =>
          a.snapshot.name.localeCompare(b.snapshot.name, "cs"),
        ),
      );
      form.setValue("clientId", result.client.id, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setClientIco(result.client.snapshot.ico ?? clientIco);
      setClientLookupMessage(
        result.existing
          ? t("clientSelected", { name: result.client.snapshot.name })
          : t("clientCreated", { name: result.client.snapshot.name }),
      );
    } finally {
      setAddingClient(false);
    }
  }

  if (issuers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t.rich("missingParties", {
          entities: () => (
            <a className="underline" href="/issuers/new">
              {t("missingIssuer")}
            </a>
          ),
        })}
      </p>
    );
  }

  const currentDueDays = diffDaysIso(watched.issueDate, watched.dueDate);

  function lastVatModeLabel(mode: LastInvoiceSuggestions["vatMode"]): string {
    switch (mode) {
      case "regular":
        return issuerVatPayer ? t("vatRegularPayer") : t("vatNonPayer");
      case "reverse_charge":
        return t("vatReverseCharge");
      case "oss":
        return t("vatOss");
      default: {
        const _exhaustive: never = mode;
        return _exhaustive;
      }
    }
  }

  function lastSuppliesLabel(
    value: LastInvoiceSuggestions["suppliesAbroad"],
  ): string {
    switch (value) {
      case "none":
        return t("suppliesNone");
      case "eu":
        return t("suppliesEu");
      case "non_eu":
        return t("suppliesNonEu");
      default: {
        const _exhaustive: never = value;
        return _exhaustive;
      }
    }
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
    <div className="grid items-start gap-8 xl:grid-cols-2">
      <form
        className="space-y-5"
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

        <FormSection
          action={
            <Button
              render={<Link href="/docs/concepts/snapshots" prefetch />}
              size="sm"
              variant="ghost"
            >
              <BookOpenIcon />
              {t("partyDocs")}
            </Button>
          }
          description={t("sectionPartiesDescription")}
          icon={<Building2Icon />}
          title={t("sectionParties")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
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
                      {i.snapshot.ico
                        ? t("icoSuffix", { ico: i.snapshot.ico })
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {selectedIssuer ? (
                <div className="bg-muted/30 rounded-md border px-3 py-2 text-xs">
                  <p className="font-medium">{selectedIssuer.snapshot.name}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {t("partyIdentifiers", {
                      ico: selectedIssuer.snapshot.ico ?? t("notSet"),
                      dic: selectedIssuer.snapshot.dic ?? t("notSet"),
                    })}
                  </p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {selectedIssuer ? (
                  <Button
                    render={
                      <Link
                        href={`/issuers/${selectedIssuer.id}/edit/identity`}
                        prefetch
                      />
                    }
                    size="sm"
                    variant="outline"
                  >
                    <Settings2Icon />
                    {t("configureIssuer")}
                  </Button>
                ) : null}
                <Button
                  render={<Link href="/issuers/new" prefetch />}
                  size="sm"
                  variant="ghost"
                >
                  <PlusIcon />
                  {t("addIssuer")}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
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
                  <option disabled value="">
                    {t("selectClient")}
                  </option>
                  {clientOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.snapshot.name}
                      {c.snapshot.ico
                        ? t("icoSuffix", { ico: c.snapshot.ico })
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {selectedClient ? (
                <div className="bg-muted/30 rounded-md border px-3 py-2 text-xs">
                  <p className="font-medium">{selectedClient.snapshot.name}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {t("partyIdentifiers", {
                      ico: selectedClient.snapshot.ico ?? t("notSet"),
                      dic: selectedClient.snapshot.dic ?? t("notSet"),
                    })}
                  </p>
                </div>
              ) : null}
              <Button
                render={<Link href="/clients/new" prefetch />}
                size="sm"
                variant="ghost"
              >
                <UserPlusIcon />
                {t("addClientManually")}
              </Button>
            </div>

            <div className="bg-muted/20 space-y-3 rounded-lg border p-4 sm:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="bg-background flex size-8 shrink-0 items-center justify-center rounded-md border">
                    <SearchIcon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {t("quickClientTitle")}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t("quickClientDescription")}
                    </p>
                  </div>
                </div>
                <Button
                  render={
                    <a
                      href="https://ares.gov.cz/ekonomicke-subjekty"
                      rel="noreferrer"
                      target="_blank"
                    />
                  }
                  size="sm"
                  variant="ghost"
                >
                  {t("openAres")}
                  <ExternalLinkIcon />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  aria-invalid={clientLookupError}
                  className="max-w-48"
                  inputMode="numeric"
                  maxLength={8}
                  onChange={(event) => setClientIco(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void addClientFromAres();
                    }
                  }}
                  pattern="\d{0,8}"
                  placeholder={t("clientIcoPlaceholder")}
                  value={clientIco}
                />
                <Button
                  disabled={addingClient}
                  loading={addingClient}
                  onClick={() => void addClientFromAres()}
                  type="button"
                  variant="secondary"
                >
                  <UserPlusIcon />
                  {addingClient ? t("addingClient") : t("addClientFromAres")}
                </Button>
              </div>
              {clientLookupMessage ? (
                <p
                  className={cn(
                    "text-xs",
                    clientLookupError
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                  role={clientLookupError ? "alert" : "status"}
                >
                  {clientLookupMessage}
                </p>
              ) : null}
            </div>
          </div>
        </FormSection>

        <FormSection
          description={t("sectionDocumentDescription")}
          icon={<FileTextIcon />}
          title={t("sectionDocument")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              description={t("docTypeDescription")}
              error={fieldError(errors, "docType")}
              label={t("docType")}
            >
              <select
                className={selectClassName()}
                {...form.register("docType")}
              >
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
              <div className="border-input bg-muted/40 flex h-9 items-center rounded-md border px-3">
                <p className="text-sm font-medium tabular-nums">
                  {numberPreview}
                </p>
              </div>
            </Field>
            <Field
              description={t("languageDescription")}
              error={fieldError(errors, "language")}
              label={t("language")}
              suggestion={
                lastInvoice && lastInvoice.language !== watched.language ? (
                  <LastValueHint
                    value={
                      lastInvoice.language === "cs"
                        ? t("languageCs")
                        : t("languageEn")
                    }
                    onApply={() =>
                      form.setValue("language", lastInvoice.language)
                    }
                  />
                ) : undefined
              }
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
              description={t("currencyDescription")}
              error={fieldError(errors, "currency")}
              label={t("currency")}
              suggestion={
                lastInvoice && lastInvoice.currency !== watched.currency ? (
                  <LastValueHint
                    value={
                      lastInvoice.currency === "CZK"
                        ? t("currencyCzk")
                        : lastInvoice.currency
                    }
                    onApply={() =>
                      form.setValue("currency", lastInvoice.currency)
                    }
                  />
                ) : undefined
              }
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
            {watched.docType === "credit_note" ? (
              <Field
                className="sm:col-span-2"
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
          </div>
        </FormSection>

        <FormSection
          description={t("sectionDatesDescription")}
          icon={<CalendarDaysIcon />}
          title={t("sectionDates")}
        >
          <div className="grid gap-4 sm:grid-cols-3">
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
              suggestion={
                lastInvoice && lastInvoice.dueDays !== currentDueDays ? (
                  <LastValueHint
                    label={t("useLastDueDays", { days: lastInvoice.dueDays })}
                    onApply={() =>
                      form.setValue(
                        "dueDate",
                        addDaysIso(watched.issueDate, lastInvoice.dueDays),
                      )
                    }
                  />
                ) : undefined
              }
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
          </div>
        </FormSection>

        <FormSection
          action={
            <Button
              render={<Link href="/docs/concepts/czech-vat" prefetch />}
              size="sm"
              variant="ghost"
            >
              <BookOpenIcon />
              {t("vatGuide")}
            </Button>
          }
          description={t("sectionVatDescription")}
          icon={<PercentIcon />}
          title={t("sectionVat")}
        >
          {issuerVatPayer ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                description={t("vatModeDescription")}
                error={fieldError(errors, "vatMode")}
                label={t("vatMode")}
                suggestion={
                  lastInvoice &&
                  issuerVatPayer &&
                  lastInvoice.vatMode !== watched.vatMode ? (
                    <LastValueHint
                      value={lastVatModeLabel(lastInvoice.vatMode)}
                      onApply={() => {
                        if (lastInvoice.vatMode === "oss") {
                          setShowAdvancedVat(true);
                        }
                        form.setValue("vatMode", lastInvoice.vatMode);
                      }}
                    />
                  ) : undefined
                }
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
                    <option value="reverse_charge">
                      {t("vatReverseCharge")}
                    </option>
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
                suggestion={
                  lastInvoice &&
                  lastInvoice.suppliesAbroad !== watched.suppliesAbroad ? (
                    <LastValueHint
                      value={lastSuppliesLabel(lastInvoice.suppliesAbroad)}
                      onApply={() =>
                        form.setValue(
                          "suppliesAbroad",
                          lastInvoice.suppliesAbroad,
                        )
                      }
                    />
                  ) : undefined
                }
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
              {watched.vatMode === "reverse_charge" ? (
                <>
                  <Field
                    description={t("legalNoteDescription")}
                    error={fieldError(errors, "legalNote")}
                    label={t("legalNote")}
                    suggestion={
                      lastInvoice?.legalNote &&
                      lastInvoice.legalNote !== (watched.legalNote ?? "") ? (
                        <LastValueHint
                          value={truncateHint(lastInvoice.legalNote)}
                          onApply={() =>
                            form.setValue(
                              "legalNote",
                              lastInvoice.legalNote ?? "",
                            )
                          }
                        />
                      ) : undefined
                    }
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
                    suggestion={
                      lastInvoice?.localReverseChargeCode &&
                      lastInvoice.localReverseChargeCode !==
                        (watched.localReverseChargeCode ?? "") ? (
                        <LastValueHint
                          value={lastInvoice.localReverseChargeCode}
                          onApply={() =>
                            form.setValue(
                              "localReverseChargeCode",
                              lastInvoice.localReverseChargeCode ?? "",
                            )
                          }
                        />
                      ) : undefined
                    }
                  >
                    <Input
                      placeholder={t("reverseChargeCodePlaceholder")}
                      {...form.register("localReverseChargeCode")}
                    />
                  </Field>
                </>
              ) : null}
            </div>
          ) : (
            <div className="bg-muted/30 flex items-start gap-3 rounded-lg border p-4">
              <span className="bg-background flex size-8 shrink-0 items-center justify-center rounded-md border">
                <PercentIcon className="size-4" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("nonVatPayerTitle")}</p>
                <p className="text-muted-foreground text-xs">
                  {t("nonVatPayerDescription")}
                </p>
              </div>
            </div>
          )}
        </FormSection>

        <FormSection
          action={
            <div className="flex flex-wrap items-center gap-2">
              {issuerVatPayer ? (
                <select
                  aria-label={t("pricesModeAria")}
                  className={selectClassName()}
                  onChange={(ev) => {
                    form.setValue(
                      "pricesIncludeVat",
                      ev.target.value === "incl",
                    );
                  }}
                  value={watched.pricesIncludeVat ? "incl" : "excl"}
                >
                  <option value="excl">{t("pricesExcl")}</option>
                  <option value="incl">{t("pricesIncl")}</option>
                </select>
              ) : null}
              {lastInvoice && lastInvoice.items.length > 0 ? (
                <Button
                  onClick={() => applyLastLines(lastInvoice.items)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("copyLastLines")}
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  append({
                    description: "",
                    quantity: 1,
                    unit: lastInvoice?.items[0]?.unit ?? "ks",
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
                <PlusIcon data-icon="inline-start" />
                {t("addRow")}
              </Button>
            </div>
          }
          description={
            !issuerVatPayer
              ? t("itemsDescriptionNonPayer")
              : watched.pricesIncludeVat
                ? t("itemsDescriptionIncl")
                : t("itemsDescription")
          }
          icon={<ListChecksIcon />}
          footer={
            totalsPreview ? (
              <p className="text-sm font-medium tabular-nums">
                {issuerVatPayer
                  ? t("totalLine", {
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
                    })
                  : t("totalLineNoVat", {
                      total: formatMoney(
                        totalsPreview.total,
                        watched.currency,
                        locale,
                      ),
                    })}
              </p>
            ) : undefined
          }
          title={t("itemsTitle")}
        >
          {fieldError(errors, "items") ? (
            <p className="text-destructive mb-3 text-xs">
              {fieldError(errors, "items")}
            </p>
          ) : null}
          <div className="space-y-4">
            {fields.map((field, index) => {
              const line = watched.items[index];
              const lastLine = lastInvoice?.items[index];
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
              const qtyErr = fieldError(
                errors,
                `items.${index}.quantity` as FieldPath<BuilderFormValues>,
              );
              const showCustomRate =
                customVatRateLines[index] === true ||
                (line?.vatRate != null &&
                  !isStandardVatRate(Number(line.vatRate)));
              return (
                <div
                  className={cn(
                    "bg-muted/20 space-y-4 rounded-lg border p-4",
                    (descErr || qtyErr) && "border-destructive/50",
                  )}
                  key={field.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {t("itemN", { n: String(index + 1) })}
                    </p>
                    <Button
                      aria-label={t("removeItem", { n: String(index + 1) })}
                      disabled={fields.length <= 1}
                      onClick={() => {
                        if (fields.length > 1) {
                          remove(index);
                        }
                      }}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                  <Field
                    error={descErr}
                    label={t("itemDescription")}
                    suggestion={
                      lastLine?.description &&
                      lastLine.description !== (line?.description ?? "") ? (
                        <LastValueHint
                          value={truncateHint(lastLine.description)}
                          onApply={() =>
                            form.setValue(
                              `items.${index}.description`,
                              lastLine.description,
                            )
                          }
                        />
                      ) : undefined
                    }
                  >
                    <Input
                      aria-invalid={Boolean(descErr)}
                      placeholder={t("descriptionPlaceholder")}
                      {...form.register(`items.${index}.description`)}
                    />
                  </Field>
                  <div
                    className={cn(
                      "grid gap-3 sm:grid-cols-2",
                      issuerVatPayer ? "lg:grid-cols-4" : "lg:grid-cols-3",
                    )}
                  >
                    <Field
                      error={qtyErr}
                      label={t("itemQuantity")}
                      suggestion={
                        lastLine && lastLine.quantity !== qty ? (
                          <LastValueHint
                            value={String(lastLine.quantity)}
                            onApply={() =>
                              form.setValue(
                                `items.${index}.quantity`,
                                lastLine.quantity,
                                { shouldValidate: true },
                              )
                            }
                          />
                        ) : undefined
                      }
                    >
                      <Input
                        aria-invalid={Boolean(qtyErr)}
                        placeholder={t("quantityPlaceholder")}
                        step="any"
                        type="number"
                        {...form.register(`items.${index}.quantity`, {
                          valueAsNumber: true,
                        })}
                      />
                    </Field>
                    <Field
                      error={fieldError(
                        errors,
                        `items.${index}.unit` as FieldPath<BuilderFormValues>,
                      )}
                      label={t("itemUnit")}
                      suggestion={
                        lastLine?.unit &&
                        lastLine.unit !== (line?.unit ?? "") ? (
                          <LastValueHint
                            value={lastLine.unit}
                            onApply={() =>
                              form.setValue(
                                `items.${index}.unit`,
                                lastLine.unit,
                              )
                            }
                          />
                        ) : undefined
                      }
                    >
                      <Input
                        placeholder={t("unitPlaceholder")}
                        {...form.register(`items.${index}.unit`)}
                      />
                    </Field>
                    <Field
                      error={fieldError(
                        errors,
                        `items.${index}.unitPriceWithoutVat` as FieldPath<BuilderFormValues>,
                      )}
                      label={
                        !issuerVatPayer
                          ? t("itemPrice")
                          : watched.pricesIncludeVat
                            ? t("itemPriceIncl")
                            : t("itemPriceExcl")
                      }
                      suggestion={
                        lastLine &&
                        lastLine.unitPriceWithoutVat !== unitPrice ? (
                          <LastValueHint
                            value={formatMoney(
                              lastLine.unitPriceWithoutVat,
                              watched.currency,
                              locale,
                            )}
                            onApply={() =>
                              form.setValue(
                                `items.${index}.unitPriceWithoutVat`,
                                lastLine.unitPriceWithoutVat,
                                { shouldValidate: true },
                              )
                            }
                          />
                        ) : undefined
                      }
                    >
                      <Input
                        placeholder={
                          !issuerVatPayer
                            ? t("priceSimplePlaceholder")
                            : watched.pricesIncludeVat
                              ? t("priceInclPlaceholder")
                              : t("pricePlaceholder")
                        }
                        step="any"
                        type="number"
                        {...form.register(
                          `items.${index}.unitPriceWithoutVat`,
                          { valueAsNumber: true },
                        )}
                      />
                    </Field>
                    {issuerVatPayer ? (
                      <Field
                        error={fieldError(
                          errors,
                          `items.${index}.vatRate` as FieldPath<BuilderFormValues>,
                        )}
                        label={t("itemVat")}
                        suggestion={
                          !hideRatePicker &&
                          lastLine &&
                          lastLine.vatRate !== rate ? (
                            <LastValueHint
                              value={`${lastLine.vatRate} %`}
                              onApply={() => {
                                if (!isStandardVatRate(lastLine.vatRate)) {
                                  setCustomVatRateLines((prev) => ({
                                    ...prev,
                                    [index]: true,
                                  }));
                                } else {
                                  setCustomVatRateLines((prev) => {
                                    const next = { ...prev };
                                    delete next[index];
                                    return next;
                                  });
                                }
                                form.setValue(
                                  `items.${index}.vatRate`,
                                  lastLine.vatRate,
                                  { shouldValidate: true },
                                );
                              }}
                            />
                          ) : undefined
                        }
                      >
                        {hideRatePicker ? (
                          <Input disabled readOnly value="0 %" />
                        ) : (
                          <select
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
                              form.setValue(
                                `items.${index}.vatRate`,
                                Number(v),
                                {
                                  shouldValidate: true,
                                },
                              );
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
                        )}
                        {hideRatePicker || !showCustomRate ? (
                          <input
                            type="hidden"
                            {...form.register(`items.${index}.vatRate`, {
                              valueAsNumber: true,
                            })}
                          />
                        ) : (
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
                        )}
                      </Field>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-right text-sm tabular-nums">
                    {t("itemLineTotal")}:{" "}
                    {formatMoney(lineTotal, watched.currency, locale)}
                  </p>
                </div>
              );
            })}
          </div>
        </FormSection>

        <FormSection
          description={t("notesDescription")}
          icon={<MessageSquareTextIcon />}
          title={t("sectionNotes")}
        >
          <Field
            error={fieldError(errors, "notes")}
            label={t("notes")}
            suggestion={
              lastInvoice?.notes &&
              lastInvoice.notes !== (watched.notes ?? "") ? (
                <LastValueHint
                  value={truncateHint(lastInvoice.notes)}
                  onApply={() =>
                    form.setValue("notes", lastInvoice.notes ?? "")
                  }
                />
              ) : undefined
            }
          >
            <Textarea
              placeholder={t("notesPlaceholder")}
              rows={3}
              {...form.register("notes")}
            />
          </Field>
        </FormSection>

        <div className="bg-background/95 sticky bottom-0 z-20 -mx-4 flex flex-wrap gap-2 border-t px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button
            disabled={submitting !== null}
            loading={submitting === "draft"}
            onClick={() => void submit("draft")}
            type="button"
            variant="outline"
          >
            <SaveIcon />
            {submitting === "draft" ? t("savingDraft") : t("saveDraft")}
          </Button>
          <Button
            disabled={submitting !== null}
            loading={submitting === "issue"}
            onClick={() => void submit("issue")}
            type="button"
          >
            <FileCheck2Icon />
            {submitting === "issue" ? t("issuing") : t("issue")}
          </Button>
          <span className="text-muted-foreground self-center text-xs">
            {mode === "edit" ? t("modeEdit") : t("modeCreate")}
          </span>
        </div>
      </form>

      <aside className="xl:sticky xl:top-3 xl:self-start">
        <InvoicePdfPreview
          className="mx-auto xl:h-[calc(100dvh-var(--header-height)-1.5rem)] xl:w-auto xl:max-w-full"
          error={previewError}
          updating={previewUpdating}
          url={previewUrl}
        />
      </aside>
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
