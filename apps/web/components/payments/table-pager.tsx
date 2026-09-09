import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export async function TablePager({
  from,
  to,
  count,
  page,
  pageCount,
  previousHref,
  nextHref,
}: {
  from: number;
  to: number;
  count: number;
  page: number;
  pageCount: number;
  previousHref: string | null;
  nextHref: string | null;
}) {
  if (count <= 0 || pageCount <= 1) return null;
  const t = await getTranslations("Payments.pager");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-xs text-muted-foreground">
        {t("pageInfo", {
          from: String(from),
          to: String(to),
          count: String(count),
        })}
      </p>
      <div className="flex gap-2">
        <Button
          disabled={!previousHref || page <= 1}
          render={
            previousHref ? <Link href={previousHref} prefetch /> : undefined
          }
          size="sm"
          variant="outline"
        >
          <ChevronLeftIcon />
          {t("previous")}
        </Button>
        <Button
          disabled={!nextHref || page >= pageCount}
          render={nextHref ? <Link href={nextHref} prefetch /> : undefined}
          size="sm"
          variant="outline"
        >
          {t("next")}
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
