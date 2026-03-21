import { AdminLayout } from "@/components/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, ShoppingCart } from "lucide-react";

export default function Analytics() {
  const [ordersThisMonth, setOrdersThisMonth] = useState(0);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);
  const [chartData, setChartData] = useState<{ service: string; count: number }[]>([]);

  useEffect(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    // Orders this month
    supabase
      .from("orders")
      .select("id, total_amount", { count: "exact" })
      .gte("created_at", monthStart)
      .then(({ data, count }) => {
        setOrdersThisMonth(count ?? 0);
        const rev = (data ?? []).reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
        setRevenueThisMonth(rev);
      });

    // Orders by service type last 30 days
    supabase
      .from("work_orders")
      .select("service_type")
      .gte("created_at", thirtyDaysAgo)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        (data ?? []).forEach((wo) => {
          counts[wo.service_type] = (counts[wo.service_type] || 0) + 1;
        });
        setChartData(
          Object.entries(counts)
            .map(([service, count]) => ({ service, count }))
            .sort((a, b) => b.count - a.count)
        );
      });
  }, []);

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary mb-6">Analytics</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Orders This Month</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary tabular-nums">{ordersThisMonth}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue This Month</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary tabular-nums">
                ${revenueThisMonth.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Orders by Service Type (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 60, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="service" angle={-45} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(174 84% 32%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
