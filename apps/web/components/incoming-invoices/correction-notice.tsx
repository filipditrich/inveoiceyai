import { Badge } from "@/components/ui/badge";
import type { AppLocale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format";
import type { CorrectionDiffEntry } from "@/lib/incoming-invoices/correction-diff";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

/**
 * Shown on a correction: what the supplier changed against the invoice we
 * rejected. An empty diff is itself a finding — the supplier resent the same
 * data — so it gets its own copy rather than an empty table.
 */
export async function CorrectionNotice({
  predecessor,
  diff,
  correctionRound,
  locale,
}: {
  predecessor: {
    id: string;
    number: string | null;
    rejectedAt: Date | null;
    rejectionReason: string | null;
  };
  diff: CorrectionDiffEntry[];
  correctionRound: number;
  locale: AppLocale;
}) {
  const t = await getTranslations("IncomingInvoices.detail.correction");

  return (
    <section
      aria-labelledby="incoming-correction"
      className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold" id="incoming-correction">
          {t("title")}
        </h2>
        {correctionRound > 1 ? (
          <Badge variant="outline">
            {t("round", { round: String(correctionRound) })}
          </Badge>
        ) : null}
      </div>

      <p className="text-muted-foreground mt-1 text-sm">
        {t("description", {
          number: predecessor.number ?? t("empty"),
          date: predecessor.rejectedAt
            ? formatDateTime(predecessor.rejectedAt, locale)
            : t("empty"),
        })}
      </p>

      {predecessor.rejectionReason ? (
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">{t("reason")}: </span>
          {predecessor.rejectionReason}
        </p>
      ) : null}

      {diff.length === 0 ? (
        <p className="mt-3 text-sm font-medium">{t("unchanged")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide">
            {t("changed")}
          </h3>
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="text-muted-foreground text-left text-xs">
              <tr>
                <th className="py-1 pr-4 font-medium">&nbsp;</th>
                <th className="py-1 pr-4 font-medium">{t("before")}</th>
                <th className="py-1 font-medium">{t("after")}</th>
              </tr>
            </thead>
            <tbody>
              {diff.map((entry) => (
                <tr className="border-t" key={entry.field}>
                  <th className="py-1.5 pr-4 text-left font-medium">
                    {t(`fields.${entry.field}` as never)}
                  </th>
                  <td
                    className={`text-muted-foreground py-1.5 pr-4 line-through ${
                      entry.numeric ? "tabular-nums" : ""
                    }`}
                  >
                    {entry.before ?? t("empty")}
                  </td>
                  <td
                    className={`py-1.5 font-medium ${
                      entry.numeric ? "tabular-nums" : ""
                    }`}
                  >
                    {entry.after ?? t("empty")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link
        className="text-brand mt-3 inline-block text-sm underline-offset-2 hover:underline"
        href={`/incoming-invoices/${predecessor.id}`}
      >
        {t("openPredecessor")}
      </Link>
    </section>
  );
}

/** Shown on the rejected invoice that a correction replaced. */
export async function SupersededNotice({
  successorId,
}: {
  successorId: string;
}) {
  const t = await getTranslations("IncomingInvoices.detail.correction");
  return (
    <section
      aria-labelledby="incoming-superseded"
      className="bg-muted/40 rounded-xl border p-4"
    >
      <h2 className="text-sm font-semibold" id="incoming-superseded">
        {t("supersededTitle")}
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        {t("supersededDescription")}
      </p>
      <Link
        className="text-brand mt-2 inline-block text-sm underline-offset-2 hover:underline"
        href={`/incoming-invoices/${successorId}`}
      >
        {t("openSuccessor")}
      </Link>
    </section>
  );
}
