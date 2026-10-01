import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Checkbox } from "@openai/apps-sdk-ui/components/Checkbox";
import { Input } from "@openai/apps-sdk-ui/components/Input";
import { createRoot } from "react-dom/client";

import {
  app,
  call,
  connect,
  extensions,
  receive,
  snapshot,
  subscribe,
} from "./bridge";
import type { Invoice, Summary, Payload } from "./contract";
import "./styles.css";

declare const INVOICEY_MESSAGES: {
  cs: (typeof import("../locales/en.json"))["McpApp"];
  en: (typeof import("../locales/en.json"))["McpApp"];
};
type Action = "issue_invoice" | "mark_invoice_paid" | "send_invoice_email";
function useInvoicey() {
  const state = useSyncExternalStore(subscribe, snapshot);
  const t = INVOICEY_MESSAGES[state.locale];
  const [query, setQuery] = useState("");
  const [unpaid, setUnpaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [email, setEmail] = useState("");
  const data = state.payload;
  const invoice = data?.invoice;
  const summary = data?.summary;
  const id = summary?.id ?? data?.invoiceId;
  const detail = Boolean(id || invoice);
  const currency = invoice?.meta.currency ?? summary?.currency ?? "CZK";
  const money = (amount: number | string, unit = currency) =>
    new Intl.NumberFormat(state.locale, {
      style: "currency",
      currency: unit,
    }).format(Number(amount));
  const date = (value: string) =>
    new Intl.DateTimeFormat(state.locale, { dateStyle: "medium" }).format(
      new Date(`${value}T12:00:00Z`),
    );
  const can = (permission: string) =>
    state.permissions?.includes(permission) ?? false;
  useEffect(() => {
    void connect();
  }, []);
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError(false);
    setNotice("");
    try {
      await work();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function search(offset = 0) {
    await perform(async () => {
      const result = await call("list_invoices", {
        query,
        unpaidOnly: unpaid,
        offset,
        limit: 25,
      });
      if (offset && data?.invoices)
        result.structuredContent = {
          ...result.payload,
          invoices: [...data.invoices, ...(result.payload.invoices ?? [])],
        };
      receive(result);
      if (app.getHostContext()?.availableDisplayModes?.includes("fullscreen"))
        await app.requestDisplayMode({ mode: "fullscreen" });
    });
  }
  async function select(row: Summary) {
    await perform(async () => {
      receive(await call("get_invoice", { id: row.id }));
    });
  }
  async function confirm() {
    if (!id || !action) return;
    await perform(async () => {
      await call(
        action,
        action === "send_invoice_email" ? { id, to: email } : { id },
      );
      setAction(null);
      setNotice(t.success);
      receive(await call("get_invoice", { id }));
    });
  }
  async function attach() {
    if (!id) return;
    await perform(async () => {
      const context = {
        content: [
          {
            type: "resource_link" as const,
            uri: `invoicey://invoices/${id}`,
            name: summary?.number ?? invoice?.meta.number ?? t.draft,
            description: summary?.clientName ?? invoice?.client.name,
          },
        ],
      };
      if (extensions.modelContext)
        await extensions.modelContext.update(context);
      else await app.updateModelContext(context);
      setNotice(t.attached);
    });
  }
  return {
    state,
    t,
    query,
    setQuery,
    unpaid,
    setUnpaid,
    busy,
    error,
    notice,
    action,
    setAction,
    email,
    setEmail,
    data,
    invoice,
    summary,
    id,
    detail,
    money,
    date,
    can,
    perform,
    search,
    select,
    confirm,
    attach,
  };
}
type Controller = ReturnType<typeof useInvoicey>;
function statusLabel(t: typeof INVOICEY_MESSAGES.en, status: string) {
  // SAFETY: own-property check restricts the runtime status to a catalog key.
  return Object.hasOwn(t, status) ? t[status as keyof typeof t] : status;
}
function InvoiceyApp() {
  const controller = useInvoicey();
  const { state, t, busy, error, notice, data, id, detail, perform, search } =
    controller;
  return (
    <main className="invoicey-app" aria-busy={busy}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            i.
          </span>
          <span>Invoicey</span>
        </div>
        <Button
          color="secondary"
          variant="ghost"
          size="sm"
          onClick={() =>
            void app.openLink({
              url: `${state.appUrl}/settings/workspace/integrations`,
            })
          }
        >
          {t.disconnect} ↗
        </Button>
      </header>
      {!detail && <InvoiceSearch controller={controller} />}
      {(error || state.error) && (
        <div className="error" role="alert">
          <p>{t.error}</p>
          <Button
            color="secondary"
            variant="outline"
            onClick={() =>
              void (id
                ? perform(async () => {
                    receive(await call("get_invoice", { id }));
                  })
                : search())
            }
          >
            {t.retry}
          </Button>
        </div>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!data && !state.error && (
        <div className="empty" role="status">
          <span className="loading-dot" />
          {t.loading}
        </div>
      )}
      {!detail && data?.invoices && (
        <InvoiceList
          controller={controller}
          invoices={data.invoices}
          nextOffset={data.nextOffset}
        />
      )}
      {detail && <InvoiceDetail controller={controller} />}
      <footer>
        <span>Invoicey</span>
        <Button
          color="secondary"
          variant="ghost"
          size="sm"
          onClick={() =>
            void app.openLink({
              url: `${state.appUrl}/docs/integrations/chatgpt`,
            })
          }
        >
          {t.guide} ↗
        </Button>
      </footer>
    </main>
  );
}
function InvoiceSearch({ controller }: { controller: Controller }) {
  const {
    t,
    query,
    setQuery,
    unpaid,
    setUnpaid,
    busy,
    state,
    perform,
    search,
    can,
  } = controller;
  return (
    <>
      <section className="intro">
        <p className="eyebrow">{t.subtitle}</p>
        <h1>{t.title}</h1>
        <Button
          color="primary"
          size="lg"
          disabled={!state.ready || busy || !can("invoices:create")}
          onClick={() =>
            void perform(async () => {
              await app.sendMessage({
                role: "user",
                content: [{ type: "text", text: t.newDraftPrompt }],
              });
            })
          }
        >
          ＋ {t.newDraft}
        </Button>
      </section>
      <form
        className="search-bar"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <Input
          aria-label={t.search}
          placeholder={t.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          size="xl"
        />
        <Button
          color="secondary"
          variant="outline"
          size="xl"
          type="submit"
          disabled={busy || !state.ready}
        >
          {t.searchButton}
        </Button>
      </form>
      <div className="list-controls">
        <Checkbox
          label={t.unpaid}
          checked={unpaid}
          onCheckedChange={setUnpaid}
        />
        <Button
          color="secondary"
          variant="ghost"
          disabled={busy || !state.ready}
          onClick={() => void search()}
        >
          {t.refresh}
        </Button>
      </div>
    </>
  );
}

function InvoiceList({
  controller,
  invoices,
  nextOffset,
}: {
  controller: Controller;
  invoices: Summary[];
  nextOffset?: number | null;
}) {
  const { t, busy, select, date, money, search } = controller;
  return (
    <section className="invoice-list" aria-label={t.items}>
      {!invoices.length && (
        <div className="empty">
          <span className="empty-symbol" aria-hidden="true">
            ▤
          </span>
          <h2>{t.empty}</h2>
          <p>{t.emptyHint}</p>
        </div>
      )}
      {invoices.map((row) => (
        <button
          className="invoice-row"
          key={row.id}
          disabled={busy}
          onClick={() => void select(row)}
        >
          <span className="invoice-icon" aria-hidden="true">
            ↗
          </span>
          <span className="invoice-label">
            <strong>{row.clientName}</strong>
            <span>
              {row.number ?? t.draft} · {date(row.dueDate)}
            </span>
          </span>
          <span className="invoice-amount">
            <strong>{money(row.total, row.currency)}</strong>
            <span className={`status ${row.displayStatus}`}>
              {statusLabel(t, row.displayStatus)}
            </span>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      ))}
      {nextOffset != null && (
        <Button
          color="secondary"
          variant="outline"
          block
          disabled={busy}
          onClick={() => void search(nextOffset ?? 0)}
        >
          {t.more}
        </Button>
      )}
    </section>
  );
}

function InvoiceDetail({ controller }: { controller: Controller }) {
  const { t, busy, search, data } = controller;
  return (
    <section className="detail">
      <Button
        color="secondary"
        variant="ghost"
        onClick={() => void search()}
        disabled={busy}
      >
        ← {t.back}
      </Button>
      <InvoiceContent controller={controller} />
      {data?.assumptions?.length ? (
        <div className="assumptions">
          <strong>{t.assumptions}</strong>
          <ul>
            {data.assumptions.map((item, index) => (
              <li key={index}>
                {item.label}: {item.value} — {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <InvoiceActions controller={controller} />
    </section>
  );
}

function InvoiceContent({ controller }: { controller: Controller }) {
  const { t, summary, invoice, money } = controller;
  const status = summary?.displayStatus ?? "draft";
  const statusText = statusLabel(t, status);
  return (
    <>
      {" "}
      <div className="detail-heading">
        <div>
          <span className={`status ${status}`}>{statusText}</span>
          <h1>{summary?.number ?? t.draft}</h1>
          <p>{invoice?.client.name ?? summary?.clientName}</p>
        </div>
        <strong className="grand-total">
          {money(invoice?.totals.total ?? summary?.total ?? 0)}
        </strong>
      </div>
      <InvoiceDates controller={controller} />
      {invoice ? (
        <InvoiceBody invoice={invoice} t={t} money={money} />
      ) : (
        <p className="muted">{t.noDetails}</p>
      )}
    </>
  );
}
function InvoiceDates({ controller }: { controller: Controller }) {
  const { t, invoice, summary, date } = controller;
  return (
    <div className="dates">
      <span>
        {t.issuedOn}
        <strong>
          {date(invoice?.meta.issueDate ?? summary?.issueDate ?? "1970-01-01")}
        </strong>
      </span>
      <span>
        {t.due}
        <strong>
          {date(invoice?.meta.dueDate ?? summary?.dueDate ?? "1970-01-01")}
        </strong>
      </span>
    </div>
  );
}
function InvoiceActions({ controller }: { controller: Controller }) {
  const { t, busy, action, setAction, email, setEmail, confirm } = controller;
  return (
    <>
      {" "}
      {action && (
        <form
          className="confirmation"
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
        >
          <p>
            {action === "issue_invoice"
              ? t.confirmIssue
              : action === "mark_invoice_paid"
                ? t.confirmPaid
                : t.confirmSend}
          </p>
          {action === "send_invoice_email" && (
            <Input
              type="email"
              required
              aria-label={t.recipient}
              placeholder={t.recipient}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              size="xl"
            />
          )}
          <div className="actions">
            <Button
              color="secondary"
              variant="outline"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              {t.cancel}
            </Button>
            <Button color="primary" type="submit" disabled={busy}>
              {t.confirm}
            </Button>
          </div>
        </form>
      )}
      <ActionButtons controller={controller} />
      <DocumentLinks
        data={controller.data}
        id={controller.id}
        appUrl={controller.state.appUrl}
        t={t}
      />
    </>
  );
}
function ActionButtons({ controller }: { controller: Controller }) {
  const { t, id, summary, busy, can, setAction, setEmail, invoice, attach } =
    controller;
  const status = summary?.displayStatus ?? "draft";
  if (!id) return null;
  return (
    <div className="actions">
      {status === "draft" && can("invoices:issue") && (
        <Button
          color="primary"
          size="lg"
          disabled={busy}
          onClick={() => setAction("issue_invoice")}
        >
          {t.issue}
        </Button>
      )}
      {status !== "draft" && status !== "cancelled" && can("invoices:send") && (
        <Button
          color="primary"
          size="lg"
          disabled={busy}
          onClick={() => {
            setEmail(invoice?.client.contactEmail ?? "");
            setAction("send_invoice_email");
          }}
        >
          {t.send}
        </Button>
      )}
      {["issued", "unpaid", "overdue", "future"].includes(status) &&
        can("payments:manage") && (
          <Button
            color="secondary"
            variant="outline"
            size="lg"
            disabled={busy}
            onClick={() => setAction("mark_invoice_paid")}
          >
            {t.markPaid}
          </Button>
        )}
      {
        <Button
          color="secondary"
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={() => void attach()}
        >
          {t.attach}
        </Button>
      }
    </div>
  );
}
function DocumentLinks({
  data,
  id,
  appUrl,
  t,
}: {
  data: Payload | null;
  id?: string;
  appUrl: string;
  t: typeof INVOICEY_MESSAGES.en;
}) {
  const pdfUrl = data?.pdfUrl;
  const isdocUrl = data?.isdocUrl;
  return (
    <div className="document-links">
      {id && (
        <Button
          color="secondary"
          variant="ghost"
          onClick={() => void app.openLink({ url: `${appUrl}/invoices/${id}` })}
        >
          {t.open} ↗
        </Button>
      )}
      {pdfUrl && (
        <Button
          color="secondary"
          variant="ghost"
          onClick={() => void app.openLink({ url: pdfUrl })}
        >
          {t.pdf} ↗
        </Button>
      )}
      {isdocUrl && (
        <Button
          color="secondary"
          variant="ghost"
          onClick={() => void app.openLink({ url: isdocUrl })}
        >
          {t.isdoc} ↓
        </Button>
      )}
    </div>
  );
}
function InvoiceBody({
  invoice,
  t,
  money,
}: {
  invoice: Invoice;
  t: typeof INVOICEY_MESSAGES.en;
  money: (amount: number | string) => string;
}) {
  return (
    <>
      <div className="parties">
        <Party label={t.supplier} party={invoice.issuer} />
        <Party label={t.client} party={invoice.client} />
      </div>
      <div className="line-items">
        {invoice.items.map((item, index) => (
          <div className="line-item" key={index}>
            <span>
              <strong>{item.description}</strong>
              <small>
                {item.quantity} {item.unit} × {money(item.unitPriceWithoutVat)}{" "}
                · {item.vatRate}% {t.vat}
              </small>
            </span>
            <strong>{money(item.lineTotal)}</strong>
          </div>
        ))}
      </div>
      <dl className="totals">
        <div>
          <dt>{t.subtotal}</dt>
          <dd>{money(invoice.totals.subtotal)}</dd>
        </div>
        <div>
          <dt>{t.vat}</dt>
          <dd>{money(invoice.totals.vatTotal)}</dd>
        </div>
        <div>
          <dt>{t.total}</dt>
          <dd>{money(invoice.totals.total)}</dd>
        </div>
      </dl>
      {invoice.notes && <p className="invoice-notes">{invoice.notes}</p>}
    </>
  );
}
function Party({ label, party }: { label: string; party: Invoice["client"] }) {
  return (
    <section>
      <p className="eyebrow">{label}</p>
      <strong>{party.name}</strong>
      <p>
        {party.address.street}
        <br />
        {party.address.zip} {party.address.city}
      </p>
      {party.ico && <p>IČO {party.ico}</p>}
    </section>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<InvoiceyApp />);
