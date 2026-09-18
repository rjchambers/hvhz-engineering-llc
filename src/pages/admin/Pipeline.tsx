import { useEffect, useMemo, useState } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  FlaskConical,
  Kanban,
  PackageOpen,
  Search,
  Table2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  BOARD_COLUMNS,
  WORK_ORDER_STATUSES,
  statusLabel,
} from "@/lib/work-order-status";
import { SERVICES } from "@/lib/services";
import {
  isBulkEligible,
  useBoardWorkOrders,
  useInvalidateWorkOrders,
  useWorkOrders,
  useWorkOrdersRealtime,
} from "@/hooks/useWorkOrders";
import { PipelineBoard } from "@/components/admin/PipelineBoard";
import { PipelineTable } from "@/components/admin/PipelineTable";
import { BulkDispatchDialog } from "@/components/admin/BulkDispatchDialog";

/**
 * The unified pipeline hub. `/admin` renders the board view and
 * `/admin/work-orders` the table view of the same data; the toggle navigates
 * between them, carrying the filters along in the query string.
 */
export default function Pipeline() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view: "board" | "table" =
    location.pathname === "/admin" ? "board" : "table";

  // Old deep links used /admin/work-orders?id=<uuid> to open the side sheet.
  const legacyId = searchParams.get("id");

  const filterStatus = searchParams.get("status") ?? "all";
  const filterService = searchParams.get("service") ?? "all";
  const urlSearch = searchParams.get("q") ?? "";

  const [searchInput, setSearchInput] = useState(urlSearch);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const [seeding, setSeeding] = useState(false);

  const setParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value && value !== "all") next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
    setPage(0);
  };

  // Debounce the search box so we don't query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput.trim() !== urlSearch) setParam("q", searchInput.trim());
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  useWorkOrdersRealtime();

  const boardQuery = useBoardWorkOrders();
  const listQuery = useWorkOrders({
    page,
    status: filterStatus,
    service: filterService,
    search: urlSearch,
  });

  // Board filters apply client-side to the loaded cards.
  const boardRows = useMemo(() => {
    let rows = boardQuery.data ?? [];
    if (filterService !== "all")
      rows = rows.filter((r) => r.service_type === filterService);
    if (urlSearch) {
      const q = urlSearch.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.client_profiles?.company_name?.toLowerCase().includes(q) ||
          r.orders?.job_address?.toLowerCase().includes(q) ||
          (r.wo_number != null && String(r.wo_number) === q)
      );
    }
    return rows;
  }, [boardQuery.data, filterService, urlSearch]);

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of boardQuery.data ?? []) {
      counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
    }
    return counts;
  }, [boardQuery.data]);

  const rows = listQuery.data?.rows ?? [];
  const total = listQuery.data?.total ?? 0;
  const eligibleOnPage = rows.filter(isBulkEligible);
  const invalidate = useInvalidateWorkOrders();

  const switchView = (next: "board" | "table") => {
    if (next === view) return;
    navigate(
      {
        pathname: next === "board" ? "/admin" : "/admin/work-orders",
        search: searchParams.toString(),
      },
      { replace: false }
    );
  };

  const openBulkDialog = () => {
    const ids =
      selectedIds.size > 0
        ? [...selectedIds]
        : eligibleOnPage.map((wo) => wo.id);
    if (ids.length === 0) {
      toast.info("Select pending in-house work orders first");
      return;
    }
    setBulkIds(ids);
    setBulkOpen(true);
  };

  const handleSeedTestWO = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const { data: techConfig } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "default_technician_id")
        .maybeSingle();
      const { data: engConfig } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "default_engineer_id")
        .maybeSingle();
      const defaultTechId = techConfig?.value || null;
      const defaultEngId = engConfig?.value || null;

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          client_id: user.id,
          services: ["fastener-calculation"],
          job_address: "750 E Sample Rd",
          job_city: "Pompano Beach",
          job_zip: "33064",
          job_county: "Broward",
          roof_area_sqft: 2400,
          total_amount: 350,
          status: "paid",
          notes: "TEST WORK ORDER — created via admin seed tool",
          roof_data: { area: 2400, pitch: "flat", type: "Modified Bitumen" },
        })
        .select()
        .single();
      if (orderErr || !order)
        throw new Error(orderErr?.message ?? "Order insert failed");

      const { error: woErr } = await supabase.from("work_orders").insert({
        order_id: order.id,
        client_id: user.id,
        service_type: "fastener-calculation",
        status: defaultTechId ? "dispatched" : "pending_dispatch",
        assigned_technician_id: defaultTechId || null,
        assigned_engineer_id: defaultEngId || null,
        scheduled_date: new Date(Date.now() + 86400000)
          .toISOString()
          .split("T")[0],
      });
      if (woErr) throw new Error(woErr.message);

      toast.success(
        "Test work order created" +
          (defaultTechId
            ? " and auto-assigned."
            : " — assign tech and engineer below.")
      );
      invalidate();
    } catch (err) {
      toast.error(
        "Seed failed: " + (err instanceof Error ? err.message : "unknown error")
      );
    }
    setSeeding(false);
  };

  if (legacyId) {
    return <Navigate to={`/admin/work-orders/${legacyId}`} replace />;
  }

  const boardEmpty =
    !boardQuery.isLoading && (boardQuery.data?.length ?? 0) === 0;

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold text-primary">Order Pipeline</h1>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && switchView(v as "board" | "table")}
            className="border rounded-md p-0.5"
          >
            <ToggleGroupItem value="board" size="sm" className="gap-1.5 px-3">
              <Kanban className="h-4 w-4" /> Board
            </ToggleGroupItem>
            <ToggleGroupItem value="table" size="sm" className="gap-1.5 px-3">
              <Table2 className="h-4 w-4" /> Table
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Stage counts — click one to see those work orders in the table */}
        <div className="flex flex-wrap gap-2 mb-5">
          {BOARD_COLUMNS.map((s) => (
            <button
              key={s}
              onClick={() => {
                if (view === "table") {
                  setParam("status", s);
                } else {
                  const next = new URLSearchParams(searchParams);
                  next.set("status", s);
                  navigate({
                    pathname: "/admin/work-orders",
                    search: next.toString(),
                  });
                }
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors hover:border-hvhz-teal/50 hover:bg-hvhz-teal/5",
                filterStatus === s && view === "table"
                  ? "border-hvhz-teal bg-hvhz-teal/10 text-hvhz-teal font-medium"
                  : "text-muted-foreground"
              )}
            >
              {statusLabel(s)}
              <span className="ml-1.5 font-semibold text-foreground">
                {stageCounts.get(s) ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search WO#, address, or company…"
              className="pl-9 w-[260px]"
            />
          </div>
          {view === "table" && (
            <Select
              value={filterStatus}
              onValueChange={(v) => setParam("status", v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {WORK_ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={filterService}
            onValueChange={(v) => setParam("service", v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {SERVICES.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {view === "table" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-hvhz-teal border-hvhz-teal/30 hover:bg-hvhz-teal/5"
              onClick={openBulkDialog}
            >
              <Zap className="h-4 w-4" />
              {selectedIds.size > 0
                ? `Bulk Dispatch (${selectedIds.size} selected)`
                : `Bulk Dispatch Pending (${eligibleOnPage.length})`}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-dashed text-muted-foreground"
            onClick={handleSeedTestWO}
            disabled={seeding}
          >
            <FlaskConical className="h-4 w-4" />
            {seeding ? "Creating…" : "Create Test WO"}
          </Button>
        </div>

        {view === "board" ? (
          boardEmpty ? (
            <div className="rounded-lg border bg-card p-16 text-center">
              <PackageOpen className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-primary">No orders yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Share hvhz.us to get started.
              </p>
            </div>
          ) : (
            <PipelineBoard workOrders={boardRows} />
          )
        ) : (
          <PipelineTable
            rows={rows}
            total={total}
            page={page}
            onPageChange={setPage}
            selectedIds={selectedIds}
            onToggleSelected={(id) =>
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onSelectAll={(ids) => setSelectedIds(new Set(ids))}
          />
        )}
      </div>

      <BulkDispatchDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        ids={bulkIds}
        onDone={() => setSelectedIds(new Set())}
      />
    </AdminLayout>
  );
}
