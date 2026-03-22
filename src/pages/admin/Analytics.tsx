import { AdminLayout } from "@/components/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { DollarSign, ShoppingCart, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getServiceName, formatCurrency } from "@/lib/services";
import { STATUS_LABELS, STATUS_BADGE_CLASSES, TAS_SERVICES, daysSince } from "@/lib/work-order-helpers";

export default function Analytics() {
  const [ordersThisMonth, setOrdersThisMonth] = useState(0);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);
  const [pendingDispatch, setPendingDispatch] = useState(0);
  const [avgTurnaround, setAvgTurnaround] = useState<number | null>(null);
  const [serviceData, setServiceData] = useState<{ service: string; count: number }[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [revenueByMonth, setRevenueByMonth] = useState<{ month: string; revenue: number }[]>([]);
  const [statusSummary, setStatusSummary] = useState<{ status: string; count: number; oldestDays: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

    setLoading(true);

    Promise.all([
      // KPI 1 & 2: Orders + revenue this month (paid only — Fix 3)
      supabase
        .from("orders")
        .select("id, total_amount", { count: "exact" })
        .gte("created_at", monthStart)
        .neq("status", "pending_payment")
        .then(({ data, count }) => {
          setOrdersThisMonth(count ?? 0);
          setRevenueThisMonth((data ?? []).reduce((s, o) => s + (Number(o.total_amount) || 0), 0));
        }),

      // KPI 3: Pending dispatch count
      supabase
        .from("work_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_dispatch")
        .then(({ count }) => setPendingDispatch(count ?? 0)),

      // KPI 4: Avg turnaround (signed WOs last 90 days — Fix 3)
      supabase
        .from("work_orders")
        .select("created_at, signed_at")
        .eq("status", "signed")
        .not("signed_at", "is", null)
        .gte("created_at", ninetyDaysAgo)
        .then(({ data }) => {
          if (!data || data.length === 0) { setAvgTurnaround(null); return; }
          const days = data.map((wo) => (new Date(wo.signed_at!).getTime() - new Date(wo.created_at).getTime()) / 86400000);
          setAvgTurnaround(Math.round(days.reduce((a, b) => a + b, 0) / days.length * 10) / 10);
        }),

      // Chart 1: Orders by service (last 30 days)
      supabase
        .from("work_orders")
        .select("service_type")
        .gte("created_at", thirtyDaysAgo)
        .then(({ data }) => {
          const counts: Record<string, number> = {};
          (data ?? []).forEach((wo) => { counts[wo.service_type] = (counts[wo.service_type] || 0) + 1; });
          setServiceData(
            Object.entries(counts)
              .map(([key, count]) => ({ service: getServiceName(key), count }))
              .sort((a, b) => b.count - a.count)
          );

          let tasCount = 0, internalCount = 0;
          (data ?? []).forEach((wo) => {
            if (TAS_SERVICES.includes(wo.service_type)) tasCount++;
            else internalCount++;
          });
          setPieData([
            { name: "Internal services", value: internalCount },
            { name: "TAS / Outsourced", value: tasCount },
          ]);
        }),

      // Revenue by month (last 6)
      supabase
        .from("orders")
        .select("created_at, total_amount")
        .gte("created_at", sixMonthsAgo)
        .then(({ data }) => {
          const monthMap: Record<string, number> = {};
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            monthMap[key] = 0;
          }
          (data ?? []).forEach((o) => {
            const d = new Date(o.created_at);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (key in monthMap) monthMap[key] += Number(o.total_amount) || 0;
          });
          const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          setRevenueByMonth(
            Object.entries(monthMap).map(([key, revenue]) => ({
              month: monthNames[parseInt(key.split("-")[1]) - 1],
              revenue,
            }))
          );
        }),

      // Status summary
      supabase
        .from("work_orders")
        .select("status, created_at")
        .then(({ data }) => {
          const groups: Record<string, { count: number; oldest: string }> = {};
          (data ?? []).forEach((wo) => {
            if (!groups[wo.status]) groups[wo.status] = { count: 0, oldest: wo.created_at };
            groups[wo.status].count++;
            if (wo.created_at < groups[wo.status].oldest) groups[wo.status].oldest = wo.created_at;
          });
          setStatusSummary(
            Object.entries(groups)
              .filter(([, v]) => v.count > 0)
              .map(([status, v]) => ({ status, count: v.count, oldestDays: daysSince(v.oldest) }))
              .sort((a, b) => b.count - a.count)
          );
        }),
    ]).finally(() => setLoading(false));
  }, []);

  const PIE_COLORS = ["hsl(174 84% 32%)", "hsl(45 93% 47%)"];

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary mb-6">Analytics</h1>

        {/* KPI Cards — Fix 9: loading skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Orders This Month</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? <div className="h-9 w-24 bg-muted animate-pulse rounded" /> : (
                <p className="text-3xl font-bold text-primary tabular-nums">{ordersThisMonth}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue This Month</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? <div className="h-9 w-24 bg-muted animate-pulse rounded" /> : (
                <p className="text-3xl font-bold text-primary tabular-nums">{formatCurrency(revenueThisMonth)}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Dispatch</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? <div className="h-9 w-24 bg-muted animate-pulse rounded" /> : (
                <p className="text-3xl font-bold text-primary tabular-nums">{pendingDispatch}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Turnaround (days)</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? <div className="h-9 w-24 bg-muted animate-pulse rounded" /> : (
                <p className="text-3xl font-bold text-primary tabular-nums">{avgTurnaround !== null ? avgTurnaround : "—"}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chart Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Orders by Service — Last 30 Days</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <LoadingSpinner size="sm" />
                </div>
              ) : serviceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={serviceData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="service" width={180} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(174 84% 32%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">No data yet</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Internal vs TAS Split — Last 30 Days</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              {loading ? (
                <div className="h-[250px] flex items-center justify-center">
                  <LoadingSpinner size="sm" />
                </div>
              ) : pieData.some((d) => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">No data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chart Row 2: Revenue by Month */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue by Month — Last 6 Months</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : revenueByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueByMonth} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `$${v.toLocaleString()}`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(174 84% 32%)" fill="hsl(174 84% 32% / 0.3)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Status Summary Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Work Order Status Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Oldest (days)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statusSummary.map((row) => (
                  <TableRow key={row.status}>
                    <TableCell>
                      <Badge className={cn("text-[11px]", STATUS_BADGE_CLASSES[row.status] ?? "bg-gray-100 text-gray-700")}>
                        {STATUS_LABELS[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{row.count}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{row.oldestDays}d</TableCell>
                  </TableRow>
                ))}
                {statusSummary.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No work orders</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
