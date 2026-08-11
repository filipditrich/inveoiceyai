"use client";

import type { MonthPoint } from "@/lib/dashboard-metrics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useFormatter, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

export function DashboardMonthlyChart({ data }: { data: MonthPoint[] }) {
  const t = useTranslations("Dashboard.chart");
  const format = useFormatter();

  const chartConfig = {
    issued: { label: t("issued"), color: "var(--chart-1)" },
    paid: { label: t("paid"), color: "var(--chart-2)" },
  } satisfies ChartConfig;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-2 sm:px-6">
        <ChartContainer
          className="aspect-auto h-[260px] w-full"
          config={chartConfig}
        >
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="month"
              tickFormatter={(v: string) => v.slice(2)}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              tickFormatter={(v: number) =>
                format.number(v, {
                  notation: "compact",
                  maximumFractionDigits: 1,
                })
              }
              tickLine={false}
              width={48}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="issued" fill="var(--color-issued)" radius={4} />
            <Bar dataKey="paid" fill="var(--color-paid)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
