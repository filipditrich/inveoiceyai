import {
  cmdAres,
  cmdClientAdd,
  cmdClients,
  cmdInvoiceCancel,
  cmdInvoiceDownload,
  cmdInvoiceIssue,
  cmdInvoiceList,
  cmdInvoiceNew,
  cmdInvoicePaid,
  cmdInvoiceSend,
  cmdInvoiceShow,
  cmdInvoiceUnpaid,
  cmdIssuers,
  cmdLogin,
  cmdLogout,
  cmdPaymentReview,
  cmdPayments,
  cmdStatus,
  cmdWhoami,
  CompanionError,
} from "./actions";
import { flagBool, parseArgv } from "./args";
import { CompanionClient } from "./client";
import { resolveSession } from "./config";
import { HELP } from "./help";
import { runInteractive } from "./interactive";
import { printError } from "./print";
import type { Ctx } from "./types";

function needRef(rest: string[], i: number): string | null {
  const ref = rest[i];
  if (!ref) {
    printError("missing invoice number or id");
    return null;
  }
  return ref;
}

type RefFn = (ctx: Ctx, ref: string) => Promise<number>;

const INVOICE_REF: Record<string, RefFn> = {
  show: cmdInvoiceShow,
  issue: cmdInvoiceIssue,
  send: cmdInvoiceSend,
  paid: cmdInvoicePaid,
  unpaid: cmdInvoiceUnpaid,
  cancel: cmdInvoiceCancel,
  pdf: (ctx, ref) => cmdInvoiceDownload(ctx, ref, "pdf"),
  isdoc: (ctx, ref) => cmdInvoiceDownload(ctx, ref, "isdoc"),
};

async function routeInvoices(ctx: Ctx, rest: string[]): Promise<number> {
  const sub = rest[1];
  if (!sub || sub === "ls" || sub === "list") return cmdInvoiceList(ctx);
  if (sub === "new") return cmdInvoiceNew(ctx);
  const action = INVOICE_REF[sub];
  if (!action) {
    printError(`unknown invoices command: ${sub}`);
    return 1;
  }
  const ref = needRef(rest, 2);
  return ref ? action(ctx, ref) : 1;
}

async function routeClients(ctx: Ctx, rest: string[]): Promise<number> {
  const sub = rest[1];
  const arg = rest[2];
  if (!sub || sub === "ls" || sub === "list") return cmdClients(ctx);
  if (sub !== "add") {
    printError(`unknown clients command: ${sub}`);
    return 1;
  }
  if (!arg) {
    printError("missing IČO");
    return 1;
  }
  return cmdClientAdd(ctx, arg);
}

async function routePayments(ctx: Ctx, rest: string[]): Promise<number> {
  const sub = rest[1];
  const arg = rest[2];
  if (!sub || sub === "ls" || sub === "list") return cmdPayments(ctx);
  if (sub !== "confirm" && sub !== "reject") {
    printError(`unknown payments command: ${sub}`);
    return 1;
  }
  if (!arg) {
    printError("missing proposal id");
    return 1;
  }
  return cmdPaymentReview(
    ctx,
    arg,
    sub === "confirm" ? "payments.confirm" : "payments.reject",
  );
}

const ROOT: Record<string, (ctx: Ctx, rest: string[]) => Promise<number>> = {
  help: async () => {
    process.stdout.write(HELP);
    return 0;
  },
  whoami: (ctx) => cmdWhoami(ctx),
  status: (ctx) => cmdStatus(ctx),
  invoices: routeInvoices,
  clients: routeClients,
  issuers: (ctx) => cmdIssuers(ctx),
  payments: routePayments,
  ares: (ctx, rest) => {
    const query = rest.slice(1).join(" ");
    if (!query) {
      printError("missing IČO or name");
      return Promise.resolve(1);
    }
    return cmdAres(ctx, query);
  },
};

async function route(ctx: Ctx, rest: string[]): Promise<number> {
  const cmd = rest[0] ?? "help";
  const handler = ROOT[cmd];
  if (!handler) {
    printError(`unknown command: ${cmd}`);
    process.stdout.write(HELP);
    return 1;
  }
  return handler(ctx, rest);
}

export async function run(argv: string[]): Promise<number> {
  const parsed = parseArgv(argv);
  if (flagBool(parsed.flags, "help")) {
    process.stdout.write(HELP);
    return 0;
  }
  if (flagBool(parsed.flags, "version")) {
    process.stdout.write("invoicey 0.1.0\n");
    return 0;
  }
  try {
    return await runCommand(parsed);
  } catch (err) {
    if (err instanceof CompanionError) {
      printError(err.message);
      return err.status === 401 ? 1 : 2;
    }
    printError(err instanceof Error ? err.message : String(err));
    return 2;
  }
}

async function runCommand(
  parsed: ReturnType<typeof parseArgv>,
): Promise<number> {
  const [cmd] = parsed.rest;
  if (cmd === "login") {
    const session = await resolveSession({ flags: parsed.flags });
    return cmdLogin(session);
  }
  if (cmd === "logout") return cmdLogout();

  const session = await resolveSession({ flags: parsed.flags });
  const wantsInteractive = parsed.rest.length === 0;
  if (!session.token) {
    if (wantsInteractive && process.stdin.isTTY) return cmdLogin(session);
    printError("not logged in — run `invoicey login` or set INVOICEY_API_KEY");
    return 1;
  }
  const ctx: Ctx = {
    client: new CompanionClient(session.apiUrl, session.token),
    json: flagBool(parsed.flags, "json"),
    yes: flagBool(parsed.flags, "yes"),
    flags: parsed.flags,
  };
  if (wantsInteractive) {
    if (!process.stdin.isTTY) {
      process.stdout.write(HELP);
      return 0;
    }
    return runInteractive(ctx);
  }
  return route(ctx, parsed.rest);
}
