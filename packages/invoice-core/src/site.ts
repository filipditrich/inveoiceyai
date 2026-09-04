const INVOICEY_ORIGIN = "https://invoicey.app/";

/** Footer “Issued with Invoicey” destination, tagged so we can tell PDF vs DOM. */
export function invoiceyIssuedWithUrl(surface: "pdf" | "dom"): string {
  const params = new URLSearchParams({
    utm_source: "invoice",
    utm_medium: surface,
    utm_campaign: "issued_with",
  });
  return `${INVOICEY_ORIGIN}?${params.toString()}`;
}
