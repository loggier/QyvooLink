
"use client"; // ¡Importante!

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartConfig } from "@/components/ui/chart" // Importa ChartConfig
import { Bar, Pie, Cell, ResponsiveContainer, BarChart as RechartsBarChart, PieChart as RechartsPieChart } from "recharts";

interface MessageStatsData {
  type: string;
  count: number;
  fill: string;
}

interface UserActivityData {
  date: string;
  activeUsers: number;
  newUsers: number;
}

interface ChartsSectionProps {
  messageStatsData: MessageStatsData[];
  chartConfigMessages: ChartConfig; // Usa el tipo ChartConfig
  userActivityData: UserActivityData[];
  chartConfigUsers: ChartConfig; // Usa el tipo ChartConfig
}

export default function ChartsSection({
  messageStatsData,
  chartConfigMessages,
  userActivityData,
  chartConfigUsers,
}: ChartsSectionProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Estadísticas de Mensajes</CardTitle>
          <CardDescription>Resumen de mensajes enviados, recibidos y automatizados.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfigMessages} className="mx-auto aspect-square max-h-[300px]">
            <RechartsPieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={messageStatsData}
                dataKey="count"
                nameKey="type"
                innerRadius={60}
                strokeWidth={5}
              >
                {messageStatsData.map((entry) => (
                   <Cell key={`cell-${entry.type}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="type" />} />
            </RechartsPieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actividad de Usuarios a lo Largo del Tiempo</CardTitle>
          <CardDescription>Usuarios activos y nuevos diariamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfigUsers} className="h-[300px] w-full">
            <RechartsBarChart accessibilityLayer data={userActivityData}>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <Bar dataKey="activeUsers" fill="var(--color-activeUsers)" radius={4} />
              <Bar dataKey="newUsers" fill="var(--color-newUsers)" radius={4} />
              <ChartLegend content={<ChartLegendContent />} />
            </RechartsBarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
