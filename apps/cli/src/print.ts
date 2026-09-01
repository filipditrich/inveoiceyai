import pc from "picocolors";

export function brand(text: string): string {
  return pc.bold(pc.yellow(text));
}

export function muted(text: string): string {
  return pc.dim(text);
}

export function ok(text: string): string {
  return pc.green(text);
}

export function bad(text: string): string {
  return pc.red(text);
}

export function money(amount: string | number, currency: string): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  const formatted = new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
  return `${formatted} ${currency}`;
}

export function pad(text: string, width: number): string {
  const clipped = text.length > width ? `${text.slice(0, width - 1)}…` : text;
  return clipped + " ".repeat(Math.max(0, width - clipped.length));
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printError(message: string): void {
  process.stderr.write(`${bad("error")}  ${message}\n`);
}

export type InvoiceRow = {
  id: string;
  number: string | null;
  clientName: string;
  total: string;
  currency: string;
  dueDate: string;
  displayStatus?: string;
  status?: string;
};

export function printInvoiceTable(rows: InvoiceRow[]): void {
  if (rows.length === 0) {
    process.stdout.write(`${muted("No invoices.")}\n`);
    return;
  }
  process.stdout.write(
    `${muted(pad("NUMBER", 14) + pad("CLIENT", 28) + pad("TOTAL", 16) + pad("STATUS", 10) + "DUE")}\n`,
  );
  for (const row of rows) {
    const status = row.displayStatus ?? row.status ?? "";
    process.stdout.write(
      `${pad(row.number ?? "draft", 14)}${pad(row.clientName, 28)}${pad(money(row.total, row.currency), 16)}${pad(status, 10)}${row.dueDate}\n`,
    );
  }
}
