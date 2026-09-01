import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Card shell shared by every admin detail section. */
export function AdminSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 border-b">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}

/** Label/value pair list; values wrap and long ids stay selectable. */
export function AdminFacts({
  items,
}: {
  items: { label: ReactNode; value: ReactNode }[];
}) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item, index) => (
        <div key={index} className="min-w-0 space-y-1">
          <dt className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
            {item.label}
          </dt>
          <dd className="min-w-0 text-sm break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Compact table for the short, capped lists on a detail page. */
export function AdminMiniTable({
  headers,
  rows,
  className,
}: {
  headers: ReactNode[];
  rows: ReactNode[][];
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-md text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {headers.map((header, index) => (
              <th key={index} className="px-2 py-2 font-medium first:pl-0">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex} className="border-b last:border-0">
              {cells.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="min-w-0 px-2 py-2.5 align-middle first:pl-0"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
