import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, PieChart } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, Pie, Cell, ResponsiveContainer, BarChart as RechartsBarChart, PieChart as RechartsPieChart } from "recharts";

const messageStatsData = [
  { type: "Enviados", count: 1250, fill: "var(--color-sent)" },
  { type: "Recibidos", count: 980, fill: "var(--color-received)" },
  { type: "Fallidos", count: 30, fill: "var(--color-failed)" },
  { type: "Automatizados", count: 600, fill: "var(--color-automated)" },
];

const chartConfigMessages = {
  count: {
    label: "Mensajes",
  },
  sent: {
    label: "Enviados",
    color: "hsl(var(--chart-1))",
  },
  received: {
    label: "Recibidos",
    color: "hsl(var(--chart-2))",
  },
  failed: {
    label: "Fallidos",
    color: "hsl(var(--destructive))",
  },
  automated: {
    label: "Automatizados",
    color: "hsl(var(--chart-4))",
  },
} satisfies import("@/components/ui/chart").ChartConfig;

const userActivityData = [
  { date: "2024-07-01", activeUsers: 120, newUsers: 15 },
  { date: "2024-07-02", activeUsers: 125, newUsers: 10 },
  { date: "2024-07-03", activeUsers: 130, newUsers: 12 },
  { date: "2024-07-04", activeUsers: 115, newUsers: 8 },
  { date: "2024-07-05", activeUsers: 140, newUsers: 20 },
  { date: "2024-07-06", activeUsers: 135, newUsers: 18 },
  { date: "2024-07-07", activeUsers: 150, newUsers: 22 },
];

const chartConfigUsers = {
  activeUsers: {
    label: "Usuarios Activos",
    color: "hsl(var(--chart-1))",
  },
  newUsers: {
    label: "Nuevos Usuarios",
    color: "hsl(var(--chart-2))",
  },
} satisfies import("@/components/ui/chart").ChartConfig;


const popularAutomations = [
  { name: "Mensaje de Bienvenida", triggers: 580, successRate: "98%" },
  { name: "Bot de Preguntas Frecuentes de Soporte", triggers: 320, successRate: "92%" },
  { name: "Respuesta de Fuera de Oficina", triggers: 210, successRate: "100%" },
  { name: "Bot de Información de Producto", triggers: 150, successRate: "85%" },
];

export default function ReportsPage() {
  return (
    <div className="space-y-8">
       <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Reportes y Analíticas</h2>
        <p className="text-muted-foreground">
          Ver reportes detallados de acciones de usuario y configuraciones en tu instalación de WhatsApp Evolution.
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Automatizaciones Populares</CardTitle>
          <CardDescription>Rendimiento de tus respuestas automáticas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre de Automatización</TableHead>
                <TableHead className="text-right">Activaciones</TableHead>
                <TableHead className="text-right">Tasa de Éxito</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {popularAutomations.map((automation) => (
                <TableRow key={automation.name}>
                  <TableCell className="font-medium">{automation.name}</TableCell>
                  <TableCell className="text-right">{automation.triggers}</TableCell>
                  <TableCell className="text-right">{automation.successRate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
