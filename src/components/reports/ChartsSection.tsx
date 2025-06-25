
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartConfig } from "@/components/ui/chart";
import { Bar, Pie, Cell, ResponsiveContainer, BarChart as RechartsBarChart, PieChart as RechartsPieChart, XAxis, YAxis, CartesianGrid } from "recharts";

interface MessageDistributionData {
  name: string;
  count: number;
  fill: string;
}

interface MessageTrendData {
  date: string;
  total: number;
}

interface ChartsSectionProps {
  messageDistributionData: MessageDistributionData[];
  chartConfigMessages: ChartConfig;
  messageTrendData: MessageTrendData[];
  chartConfigTrend: ChartConfig;
}

export default function ChartsSection({
  messageDistributionData,
  chartConfigMessages,
  messageTrendData,
  chartConfigTrend,
}: ChartsSectionProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Distribución de Mensajes</CardTitle>
          <CardDescription>Proporción de mensajes por tipo de remitente.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfigMessages} className="mx-auto aspect-square max-h-[300px]">
            <RechartsPieChart>
              <ChartTooltip 
                cursor={false}
                content={<ChartTooltipContent hideLabel />} 
              />
              <Pie
                data={messageDistributionData}
                dataKey="count"
                nameKey="name"
                innerRadius={60}
                strokeWidth={5}
                labelLine={false}
                label={({
                    cy,
                    midAngle,
                    innerRadius,
                    outerRadius,
                    percent,
                }) => {
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cy + radius * Math.cos(-midAngle * (Math.PI / 180));
                    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                    if (percent < 0.05) return null;
                    return (
                        <text
                          x={x}
                          y={y}
                          fill="white"
                          textAnchor={x > cy ? "start" : "end"}
                          dominantBaseline="central"
                          className="text-xs font-bold"
                        >
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                    );
                }}
              >
                {messageDistributionData.map((entry) => (
                   <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </RechartsPieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tendencia de Mensajes (Últimos 7 Días)</CardTitle>
          <CardDescription>Volumen total de mensajes diarios.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfigTrend} className="h-[300px] w-full">
            <RechartsBarChart
              accessibilityLayer
              data={messageTrendData}
              margin={{ top: 20, right: 20, left: -10, bottom: 0 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value.slice(0, 6)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={10}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <Bar dataKey="total" fill="var(--color-total)" radius={8} />
              <ChartLegend content={<ChartLegendContent />} />
            </RechartsBarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
