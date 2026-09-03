import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

/** Honest three-state cell: some of these rows we lose on purpose. */
type Support = "no" | "partial" | "yes";

/**
 * Columns are always Invoicey, Fakturoid, iDoklad, FakturaOnline — the three
 * Czech tools people actually mention when they ask what Invoicey replaces.
 * Message keys are spelled out because the catalog is statically typed.
 */
const ROWS = [
  {
    key: "freeUnlimited",
    label: "freeUnlimitedLabel",
    notes: [
      "freeUnlimitedNote0",
      "freeUnlimitedNote1",
      "freeUnlimitedNote2",
      "freeUnlimitedNote3",
    ],
    values: ["yes", "partial", "partial", "partial"],
  },
  {
    key: "ares",
    label: "aresLabel",
    notes: ["aresNote0", "aresNote1", "aresNote2", "aresNote3"],
    values: ["yes", "yes", "yes", "yes"],
  },
  {
    key: "isdoc",
    label: "isdocLabel",
    notes: ["isdocNote0", "isdocNote1", "isdocNote2", "isdocNote3"],
    values: ["yes", "yes", "yes", "no"],
  },
  {
    key: "qr",
    label: "qrLabel",
    notes: ["qrNote0", "qrNote1", "qrNote2", "qrNote3"],
    values: ["yes", "yes", "yes", "yes"],
  },
  {
    key: "bankMatching",
    label: "bankMatchingLabel",
    notes: [
      "bankMatchingNote0",
      "bankMatchingNote1",
      "bankMatchingNote2",
      "bankMatchingNote3",
    ],
    values: ["partial", "partial", "partial", "no"],
  },
  {
    key: "recurring",
    label: "recurringLabel",
    notes: [
      "recurringNote0",
      "recurringNote1",
      "recurringNote2",
      "recurringNote3",
    ],
    values: ["yes", "partial", "partial", "no"],
  },
  {
    key: "mcp",
    label: "mcpLabel",
    notes: ["mcpNote0", "mcpNote1", "mcpNote2", "mcpNote3"],
    values: ["yes", "yes", "no", "no"],
  },
  {
    key: "slack",
    label: "slackLabel",
    notes: ["slackNote0", "slackNote1", "slackNote2", "slackNote3"],
    values: ["yes", "no", "no", "no"],
  },
  {
    key: "cli",
    label: "cliLabel",
    notes: ["cliNote0", "cliNote1", "cliNote2", "cliNote3"],
    values: ["yes", "no", "no", "no"],
  },
  {
    key: "macApp",
    label: "macAppLabel",
    notes: ["macAppNote0", "macAppNote1", "macAppNote2", "macAppNote3"],
    values: ["yes", "no", "no", "no"],
  },
  {
    key: "accounting",
    label: "accountingLabel",
    notes: [
      "accountingNote0",
      "accountingNote1",
      "accountingNote2",
      "accountingNote3",
    ],
    values: ["partial", "yes", "yes", "no"],
  },
  {
    key: "mobileApp",
    label: "mobileAppLabel",
    notes: [
      "mobileAppNote0",
      "mobileAppNote1",
      "mobileAppNote2",
      "mobileAppNote3",
    ],
    values: ["no", "yes", "yes", "no"],
  },
] as const satisfies readonly {
  key: string;
  label: string;
  notes: readonly string[];
  values: readonly Support[];
}[];

const COMPETITORS = [
  "fakturoidName",
  "idokladName",
  "fakturaonlineName",
] as const;

export async function CompetitorComparison() {
  const t = await getTranslations("Marketing.comparison");

  return (
    <div className="mt-14 overflow-hidden rounded-3xl border bg-card shadow-xs">
      {/* The table scrolls sideways on narrow screens, so it must be reachable by keyboard. */}
      <div
        aria-label={t("tableCaption")}
        className="overflow-x-auto"
        role="region"
        tabIndex={0}
      >
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <caption className="sr-only">{t("tableCaption")}</caption>
          <thead>
            <tr className="border-b">
              <th
                scope="col"
                className="w-[34%] px-5 py-4 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {t("featureHeader")}
              </th>
              <th
                scope="col"
                className="w-[16.5%] border-x bg-brand/10 px-4 py-4 text-center"
              >
                <BrandLogo size={20} variant="wordmark" className="mx-auto" />
              </th>
              {COMPETITORS.map((competitor) => (
                <th
                  scope="col"
                  key={competitor}
                  className="w-[16.5%] px-4 py-4 text-center text-sm font-semibold"
                >
                  {t(competitor)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.key}
                className="group border-b last:border-0 hover:bg-muted/40"
              >
                <th
                  scope="row"
                  className="px-5 py-3.5 text-left align-middle font-medium"
                >
                  {t(row.label)}
                </th>
                {row.notes.map((note, index) => (
                  <td
                    key={note}
                    className={cn(
                      "px-4 py-3.5 text-center align-middle",
                      index === 0 &&
                        "border-x bg-brand/10 group-hover:bg-brand/16",
                    )}
                  >
                    <SupportCell
                      featured={index === 0}
                      note={t(note)}
                      support={row.values[index]!}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t bg-muted/30 px-5 py-4 text-xs leading-relaxed text-muted-foreground">
        {t("disclaimer")}
      </p>
    </div>
  );
}

function SupportCell({
  featured,
  note,
  support,
}: Readonly<{ featured: boolean; note: string; support: Support }>) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span
        className={cn(
          "grid size-6 place-items-center rounded-full",
          support === "yes" && featured && "bg-primary text-primary-foreground",
          support === "yes" &&
            !featured &&
            "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
          support === "partial" &&
            "bg-amber-500/20 text-amber-800 dark:text-amber-300",
          support === "no" && "text-muted-foreground/40",
        )}
      >
        {support === "yes" ? (
          <CheckIcon className={cn("size-3.5", featured && "size-4")} />
        ) : support === "partial" ? (
          <span className="size-1.5 rounded-full bg-current" />
        ) : null}
      </span>
      {note.length > 0 ? (
        <span
          className={cn(
            "max-w-[11rem] text-[0.72rem] leading-snug text-pretty",
            featured ? "font-medium text-foreground/90" : "text-foreground/75",
          )}
        >
          {note}
        </span>
      ) : null}
    </span>
  );
}
