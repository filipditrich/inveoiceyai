/**
 * A deliberately small product-event contract.  Values are state labels only:
 * callers cannot attach invoice/customer data by accident.
 */
export const PRODUCT_EVENT_PROPERTIES = {
  onboarding_started: ["routeKind"] as const,
  onboarding_completed: ["routeKind"] as const,
  invoice_draft_saved: ["creationEntry", "documentType", "currency"] as const,
  invoice_draft_recovered: ["creationEntry"] as const,
  invoice_issued: ["documentType", "currency", "lifecycleStatus"] as const,
  invoice_email_requested: ["documentType", "hasIsdoc"] as const,
  payment_match_confirmed: ["lifecycleStatus"] as const,
} as const;

export type ProductEventName = keyof typeof PRODUCT_EVENT_PROPERTIES;
export type ProductAnalyticsProperties = Partial<{
  routeKind: "welcome" | "invoice" | "payments";
  creationEntry: "structured" | "ai" | "json" | "duplicate";
  documentType: "invoice" | "proforma" | "advance" | "credit_note";
  currency: "CZK" | "EUR" | "USD";
  lifecycleStatus:
    | "draft"
    | "unpaid"
    | "overdue"
    | "future"
    | "paid"
    | "cancelled";
  hasIsdoc: boolean;
}>;

export type ProductAnalyticsAdapter = {
  track: (
    name: ProductEventName,
    properties: ProductAnalyticsProperties,
  ) => void;
};

export type ProductToastTransition =
  | "invoice_issued"
  | "invoice_saved"
  | "invoice_emailed"
  | "payment_confirmed";

export function isProductEventName(value: unknown): value is ProductEventName {
  return (
    typeof value === "string" && Object.hasOwn(PRODUCT_EVENT_PROPERTIES, value)
  );
}

export function productEventFromToast(
  toast: string | null | undefined,
): ProductEventName | null {
  switch (toast) {
    case "invoice_issued":
      return "invoice_issued";
    case "invoice_saved":
      return "invoice_draft_saved";
    case "invoice_emailed":
      return "invoice_email_requested";
    case "payment_confirmed":
      return "payment_match_confirmed";
    default:
      return null;
  }
}

export function productToastTransitionFromUrl(
  serverToast: string | null | undefined,
  urlToast: string | null,
): ProductEventName | null {
  if (!serverToast || serverToast !== urlToast) return null;
  return productEventFromToast(serverToast);
}

const sensitiveKey =
  /email|name|text|number|amount|bank|iban|token|key|content|address|client|issuer/i;

const allowedValues: Record<
  keyof ProductAnalyticsProperties,
  readonly (string | boolean)[]
> = {
  routeKind: ["welcome", "invoice", "payments"],
  creationEntry: ["structured", "ai", "json", "duplicate"],
  documentType: ["invoice", "proforma", "advance", "credit_note"],
  currency: ["CZK", "EUR", "USD"],
  lifecycleStatus: [
    "draft",
    "unpaid",
    "overdue",
    "future",
    "paid",
    "cancelled",
  ],
  hasIsdoc: [true, false],
};

function isAllowedValue(key: string, value: unknown): boolean {
  return (
    Object.hasOwn(allowedValues, key) &&
    allowedValues[key as keyof ProductAnalyticsProperties].includes(
      value as never,
    )
  );
}

export function validateProductEvent(
  name: string,
  properties: ProductAnalyticsProperties,
): boolean {
  if (!isProductEventName(name)) return false;
  const allowed = PRODUCT_EVENT_PROPERTIES[name] as readonly string[];
  return Object.entries(properties).every(
    ([key, value]) =>
      !sensitiveKey.test(key) &&
      allowed.includes(key) &&
      isAllowedValue(key, value),
  );
}

export function productEventProperties(
  name: string,
  properties: ProductAnalyticsProperties,
): ProductAnalyticsProperties {
  if (!isProductEventName(name)) return {};
  const allowed = PRODUCT_EVENT_PROPERTIES[name] as readonly string[];
  return Object.fromEntries(
    Object.entries(properties).filter(
      ([key, value]) =>
        !sensitiveKey.test(key) &&
        allowed.includes(key) &&
        isAllowedValue(key, value),
    ),
  ) as ProductAnalyticsProperties;
}

export function trackProductEvent(
  adapter: ProductAnalyticsAdapter | null,
  hasMeasurementConsent: boolean,
  name: ProductEventName,
  properties: ProductAnalyticsProperties = {},
): boolean {
  if (
    !hasMeasurementConsent ||
    !adapter ||
    !validateProductEvent(name, properties)
  ) {
    return false;
  }
  adapter.track(name, properties);
  return true;
}

const browserEventName = "invoicey:product-event";

/** Queue a validated event for the consent-aware browser adapter. */
export function emitProductEvent(
  name: ProductEventName,
  properties: ProductAnalyticsProperties = {},
): boolean {
  if (
    typeof window === "undefined" ||
    !validateProductEvent(name, properties)
  ) {
    return false;
  }
  window.dispatchEvent(
    new CustomEvent(browserEventName, { detail: { name, properties } }),
  );
  return true;
}

export function productAnalyticsBrowserEventName() {
  return browserEventName;
}
