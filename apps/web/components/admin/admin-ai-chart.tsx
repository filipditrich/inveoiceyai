"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import type { AdminAiDayPoint } from "@/lib/admin/ai";

export function AdminAiChart({ data }: { data: AdminAiDayPoint[] }) {
  const t = useTranslations("Admin.ai.chart");

  const chartConfig = {
    web: { label: t("web"), color: "var(--chart-1)" },
    slack: { label: t("slack"), color: "var(--chart-2)" },
    mcp: { label: t("mcp"), color: "var(--chart-3)" },
    extract: { label: t("extract"), color: "var(--chart-4)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer
      className="aspect-auto h-[260px] w-full"
      config={chartConfig}
    >
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="day"
          tickFormatter={(v: string) => v.slice(5)}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis axisLine={false} tickLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="web" fill="var(--color-web)" stackId="a" />
        <Bar dataKey="slack" fill="var(--color-slack)" stackId="a" />
        <Bar dataKey="mcp" fill="var(--color-mcp)" stackId="a" />
        <Bar
          dataKey="extract"
          fill="var(--color-extract)"
          radius={[4, 4, 0, 0]}
          stackId="a"
        />
      </BarChart>
    </ChartContainer>
  );
}
