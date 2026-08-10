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
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const chartConfig = {
	issued: { label: "Issued", color: "var(--chart-1)" },
	paid: { label: "Paid", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function DashboardMonthlyChart({ data }: { data: MonthPoint[] }) {
	return (
		<Card className="@container/card">
			<CardHeader>
				<CardTitle>Issued vs paid</CardTitle>
				<CardDescription>Last 12 months (amount, CZK)</CardDescription>
			</CardHeader>
			<CardContent className="px-2 pt-2 sm:px-6">
				<ChartContainer className="aspect-auto h-[260px] w-full" config={chartConfig}>
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
								v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
							}
							tickLine={false}
							width={40}
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
