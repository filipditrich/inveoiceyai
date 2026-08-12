const SNIPPET_MAX_LENGTH = 400;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function clipSnippet(text: string): string {
  const compact = text.replace(/\s+/gu, " ").trim();
  if (compact.length <= SNIPPET_MAX_LENGTH) return compact;
  return `${compact.slice(0, SNIPPET_MAX_LENGTH - 1).trimEnd()}…`;
}

function joinParts(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

function formatAddress(value: unknown): string | undefined {
  if (typeof value === "string") return asTrimmedString(value);
  if (!isRecord(value)) return undefined;
  const street = asTrimmedString(value.street);
  const city = asTrimmedString(value.city);
  const zip = asTrimmedString(value.zip);
  return joinParts([street, city, zip]) || undefined;
}

function formatCompanyLine(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const name = asTrimmedString(value.name);
  const ico = asTrimmedString(value.ico);
  const dic = asTrimmedString(value.dic);
  const address =
    asTrimmedString(value.addressText) ?? formatAddress(value.address);
  if (!name && !ico) return undefined;
  return joinParts([
    name,
    ico ? `IČO ${ico}` : undefined,
    dic ? `DIČ ${dic}` : undefined,
    address,
  ]);
}

function asAmountString(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return asTrimmedString(value);
}

function formatInvoiceLine(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const number = asTrimmedString(value.number);
  const clientName = asTrimmedString(value.clientName);
  const total = asAmountString(value.total);
  const currency = asTrimmedString(value.currency);
  const status =
    asTrimmedString(value.displayStatus) ?? asTrimmedString(value.status);
  const amount =
    total && currency ? `${total} ${currency}` : (total ?? undefined);
  return joinParts([number, clientName, amount, status]);
}

function formatFailure(record: Record<string, unknown>): string {
  const message = asTrimmedString(record.message);
  const error = asTrimmedString(record.error);
  const kind = asTrimmedString(record.kind);
  if (Array.isArray(record.issues) && record.issues.length > 0) {
    const details = record.issues
      .filter(isRecord)
      .slice(0, 3)
      .map((issue) => {
        const path = asTrimmedString(issue.path);
        const text = asTrimmedString(issue.message);
        if (path && text) return `${path}: ${text}`;
        return text ?? path;
      })
      .filter((part): part is string => Boolean(part));
    if (details.length > 0) {
      const extra =
        record.issues.length > details.length
          ? ` (+${record.issues.length - details.length} more)`
          : "";
      return `Needs input: ${details.join("; ")}${extra}`;
    }
  }
  const detail = message ?? error;
  if (detail && kind && kind !== detail) return `${kind}: ${detail}`;
  if (detail) return detail;
  if (kind) return kind;
  return "Failed";
}

function formatSearchBusiness(record: Record<string, unknown>): string {
  const matches = Array.isArray(record.matches)
    ? record.matches.filter(isRecord)
    : [];
  const total =
    typeof record.total === "number" ? record.total : matches.length;
  if (matches.length === 0) {
    const query = asTrimmedString(record.query);
    return query ? `No ARES matches for "${query}"` : "No ARES matches";
  }
  if (matches.length === 1) {
    return formatCompanyLine(matches[0]) ?? "1 ARES match";
  }
  const lines = matches
    .slice(0, 3)
    .map((match) => {
      const name = asTrimmedString(match.name);
      const ico = asTrimmedString(match.ico);
      if (name && ico) return `${name} (${ico})`;
      return name ?? (ico ? `IČO ${ico}` : undefined);
    })
    .filter((line): line is string => Boolean(line));
  const more = total > lines.length ? ` (+${total - lines.length} more)` : "";
  return `${total} ARES match${total === 1 ? "" : "es"}: ${lines.join("; ")}${more}`;
}

function formatLookupBusiness(record: Record<string, unknown>): string {
  return (
    formatCompanyLine(record.draft) ??
    formatCompanyLine(record) ??
    "Company found in ARES"
  );
}

function formatPresets(record: Record<string, unknown>): string {
  if (isRecord(record.preset)) {
    const name = asTrimmedString(record.preset.name);
    const kind = asTrimmedString(record.preset.kind);
    return joinParts([name ?? "Preset saved", kind]) || "Preset saved";
  }
  const presets = Array.isArray(record.presets)
    ? record.presets.filter(isRecord)
    : [];
  if (presets.length === 0) return "No presets";
  const names = presets
    .slice(0, 4)
    .map((preset) => asTrimmedString(preset.name))
    .filter((name): name is string => Boolean(name));
  const more =
    presets.length > names.length
      ? ` (+${presets.length - names.length} more)`
      : "";
  return `${presets.length} preset${presets.length === 1 ? "" : "s"}: ${names.join(", ")}${more}`;
}

function formatInvoices(record: Record<string, unknown>): string {
  const invoices = Array.isArray(record.invoices)
    ? record.invoices.filter(isRecord)
    : [];
  if (invoices.length === 0) return "No invoices";
  const lines = invoices
    .slice(0, 3)
    .map((row) => formatInvoiceLine(row))
    .filter((line): line is string => Boolean(line));
  const more =
    invoices.length > lines.length
      ? ` (+${invoices.length - lines.length} more)`
      : "";
  return `${invoices.length} invoice${invoices.length === 1 ? "" : "s"}: ${lines.join("; ")}${more}`;
}

function formatCreateInvoice(record: Record<string, unknown>): string {
  const line = formatInvoiceLine(record);
  const uploaded =
    record.uploadedToSlack === true ? "uploaded to Slack" : undefined;
  return joinParts([line ? `Draft ${line}` : "Draft created", uploaded]);
}

function formatIssueInvoice(record: Record<string, unknown>): string {
  const summaryLine = formatInvoiceLine(record.summary);
  const line = summaryLine ?? formatInvoiceLine(record);
  const already = record.alreadyIssued === true ? "already issued" : undefined;
  return joinParts([line ? `Issued ${line}` : "Invoice issued", already]);
}

function formatGetInvoice(record: Record<string, unknown>): string {
  return (
    formatInvoiceLine(record.summary) ??
    formatInvoiceLine(record) ??
    "Invoice loaded"
  );
}

function formatPaidInvoice(record: Record<string, unknown>): string {
  const line = formatInvoiceLine(record.summary) ?? formatInvoiceLine(record);
  return line ? `Paid ${line}` : "Marked paid";
}

function formatSendEmail(record: Record<string, unknown>): string {
  const to = asTrimmedString(record.to);
  const summary = formatInvoiceLine(record.summary);
  return joinParts([to ? `Emailed ${to}` : "Invoice email sent", summary]);
}

function formatUpload(record: Record<string, unknown>): string {
  const ids = Array.isArray(record.fileIds) ? record.fileIds.length : 0;
  if (ids > 0) return `Uploaded ${ids} file${ids === 1 ? "" : "s"} to Slack`;
  return "Uploaded PDF and ISDOC to Slack";
}

function formatGenericSuccess(record: Record<string, unknown>): string {
  const company = formatCompanyLine(record.draft) ?? formatCompanyLine(record);
  if (company) return company;
  const invoice =
    formatInvoiceLine(record.summary) ?? formatInvoiceLine(record);
  if (invoice) return invoice;
  if (Array.isArray(record.matches)) return formatSearchBusiness(record);
  if (Array.isArray(record.invoices)) return formatInvoices(record);
  if (Array.isArray(record.presets) || isRecord(record.preset)) {
    return formatPresets(record);
  }
  const to = asTrimmedString(record.to);
  if (to) return `Emailed ${to}`;
  return "Done";
}

/** Short Slack thinking-step line for a tool result (not just "ok" / "error"). */
export function toolOutputSnippet(
  toolName: string,
  output: unknown,
): string | undefined {
  if (typeof output === "string") {
    const trimmed = output.trim();
    if (trimmed.length === 0) return undefined;
    if (trimmed === "ok" || trimmed === "error") return undefined;
    return clipSnippet(trimmed);
  }
  if (!isRecord(output)) return undefined;

  if (output.ok === false) return clipSnippet(formatFailure(output));

  switch (toolName) {
    case "search_business":
      return clipSnippet(formatSearchBusiness(output));
    case "lookup_business":
      return clipSnippet(formatLookupBusiness(output));
    case "list_presets":
    case "get_preset":
    case "save_preset":
      return clipSnippet(formatPresets(output));
    case "create_invoice":
      return clipSnippet(formatCreateInvoice(output));
    case "issue_invoice":
      return clipSnippet(formatIssueInvoice(output));
    case "get_invoice":
      return clipSnippet(formatGetInvoice(output));
    case "list_invoices":
      return clipSnippet(formatInvoices(output));
    case "mark_invoice_paid":
      return clipSnippet(formatPaidInvoice(output));
    case "send_invoice_email":
      return clipSnippet(formatSendEmail(output));
    case "upload_invoice_files":
      return clipSnippet(formatUpload(output));
    default:
      return clipSnippet(formatGenericSuccess(output));
  }
}
