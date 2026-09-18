// Data layer for the admin pipeline. All work-order fetching and mutating
// goes through react-query so every surface (board, table, detail page)
// shares one cache and invalidation story instead of hand-rolled
// fetch-on-mount effects.
import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isOutsourced } from "@/lib/work-order-status";

export const WO_PAGE_SIZE = 25;

/** In-house work orders awaiting dispatch can be bulk-dispatched. */
export const isBulkEligible = (wo: {
  status: string;
  service_type: string;
}) => wo.status === "pending_dispatch" && !isOutsourced(wo.service_type);

// ---------------------------------------------------------------------------
// Row shapes

export interface OrderSummary {
  job_address: string | null;
  job_city: string | null;
  job_zip: string | null;
  job_county: string | null;
  notes: string | null;
  services: string[];
  gated_community: boolean | null;
  gate_code: string | null;
  roof_area_sqft: number | null;
  roof_data: Record<string, unknown> | null;
  site_context: Record<string, unknown> | null;
  noa_document_path: string | null;
  noa_document_name: string | null;
  roof_report_path: string | null;
  roof_report_name: string | null;
  roof_report_type: string | null;
  total_amount: number | null;
  created_at: string | null;
}

export interface ClientProfile {
  user_id: string;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  company_address: string | null;
  company_city: string | null;
  company_state: string | null;
  company_zip: string | null;
  contractor_license: string | null;
  preferred_contact: string | null;
  tech_instructions?: string | null;
}

export interface WorkOrderRow {
  id: string;
  wo_number: number | null;
  service_type: string;
  status: string;
  created_at: string;
  scheduled_date: string | null;
  client_id: string;
  order_id: string;
  assigned_technician_id: string | null;
  assigned_engineer_id: string | null;
  outsource_company: string | null;
  outsource_email_sent_at: string | null;
  result_pdf_url: string | null;
  rejection_notes: string | null;
  pe_notes: string | null;
  orders?: OrderSummary | null;
  client_profiles?: ClientProfile | null;
}

export interface RoleUser {
  user_id: string;
  displayName: string;
}

export interface OutsourcePartner {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string;
  services: string[];
  email_template: string | null;
  active: boolean;
}

export interface WorkOrderFilters {
  page: number;
  status: string; // "all" or a WorkOrderStatus
  service: string; // "all" or a service id
  search: string;
}

const ORDER_SELECT =
  "job_address, job_city, job_zip, job_county, notes, services, gated_community, gate_code, roof_area_sqft, roof_data, site_context, noa_document_path, noa_document_name, roof_report_path, roof_report_name, roof_report_type, total_amount, created_at";

const PROFILE_SELECT =
  "user_id, company_name, contact_name, contact_email, contact_phone, company_address, company_city, company_state, company_zip, contractor_license, preferred_contact, tech_instructions";

// client_profiles has no FK from work_orders, so the join is done by hand in
// exactly one place: collect client ids, fetch profiles, merge.
async function attachClientProfiles<
  T extends { client_id: string }
>(rows: T[]): Promise<(T & { client_profiles: ClientProfile | null })[]> {
  const clientIds = [...new Set(rows.map((r) => r.client_id))];
  if (clientIds.length === 0) {
    return rows.map((r) => ({ ...r, client_profiles: null }));
  }
  const { data: profiles } = await supabase
    .from("client_profiles")
    .select(PROFILE_SELECT)
    .in("user_id", clientIds);
  const map = new Map(
    ((profiles ?? []) as ClientProfile[]).map((p) => [p.user_id, p])
  );
  return rows.map((r) => ({
    ...r,
    client_profiles: map.get(r.client_id) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Queries

export function useWorkOrders(filters: WorkOrderFilters) {
  return useQuery({
    queryKey: ["work-orders", "list", filters],
    queryFn: async (): Promise<{ rows: WorkOrderRow[]; total: number }> => {
      let query = supabase
        .from("work_orders")
        .select(`*, orders(${ORDER_SELECT})`, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(
          filters.page * WO_PAGE_SIZE,
          (filters.page + 1) * WO_PAGE_SIZE - 1
        );

      if (filters.status !== "all") query = query.eq("status", filters.status);
      if (filters.service !== "all")
        query = query.eq("service_type", filters.service);

      // Text search: WO#, order address, or client company.
      if (filters.search) {
        const escaped = filters.search.replace(/[%,()]/g, " ").trim();
        const conditions: string[] = [];
        if (/^\d+$/.test(escaped)) conditions.push(`wo_number.eq.${escaped}`);
        if (escaped) {
          const [{ data: orderHits }, { data: companyHits }] =
            await Promise.all([
              supabase
                .from("orders")
                .select("id")
                .ilike("job_address", `%${escaped}%`)
                .limit(100),
              supabase
                .from("client_profiles")
                .select("user_id")
                .ilike("company_name", `%${escaped}%`)
                .limit(100),
            ]);
          if (orderHits?.length)
            conditions.push(
              `order_id.in.(${orderHits.map((o) => o.id).join(",")})`
            );
          if (companyHits?.length)
            conditions.push(
              `client_id.in.(${companyHits.map((c) => c.user_id).join(",")})`
            );
        }
        if (conditions.length === 0) return { rows: [], total: 0 };
        query = query.or(conditions.join(","));
      }

      const { data, count, error } = await query;
      if (error) throw error;
      const rows = await attachClientProfiles(
        (data ?? []) as unknown as WorkOrderRow[]
      );
      return { rows, total: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });
}

/**
 * Board data: the most recent 300 work orders with just the fields cards
 * need. Kept as its own query so board drags can update it optimistically.
 */
export interface BoardWorkOrder {
  id: string;
  wo_number: number | null;
  service_type: string;
  status: string;
  created_at: string;
  client_id: string;
  order_id: string;
  scheduled_date: string | null;
  orders?: { job_address: string | null; job_city: string | null } | null;
  client_profiles?: ClientProfile | null;
}

export function useBoardWorkOrders() {
  return useQuery({
    queryKey: ["work-orders", "board"],
    queryFn: async (): Promise<BoardWorkOrder[]> => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(
          "id, wo_number, service_type, status, created_at, client_id, order_id, scheduled_date, orders(job_address, job_city)"
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return attachClientProfiles((data ?? []) as unknown as BoardWorkOrder[]);
    },
  });
}

export function useWorkOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["work-orders", "detail", id],
    enabled: !!id,
    queryFn: async (): Promise<WorkOrderRow | null> => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`*, orders(${ORDER_SELECT})`)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [row] = await attachClientProfiles([
        data as unknown as WorkOrderRow,
      ]);
      return row;
    },
  });
}

export interface SiblingWorkOrder {
  id: string;
  wo_number: number | null;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  created_at: string;
}

/** The other work orders spawned by the same parent order. */
export function useSiblingWorkOrders(
  orderId: string | undefined,
  excludeId: string | undefined
) {
  return useQuery({
    queryKey: ["work-orders", "siblings", orderId, excludeId],
    enabled: !!orderId,
    queryFn: async (): Promise<SiblingWorkOrder[]> => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, wo_number, service_type, status, scheduled_date, created_at")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as SiblingWorkOrder[]).filter(
        (wo) => wo.id !== excludeId
      );
    },
  });
}

export function useRoleDirectory() {
  return useQuery({
    queryKey: ["role-directory"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{ techs: RoleUser[]; engineers: RoleUser[] }> => {
      const [{ data: techRoles }, { data: engRoles }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "technician"),
        supabase.from("user_roles").select("user_id").eq("role", "engineer"),
      ]);
      const techUids = (techRoles ?? []).map((r) => r.user_id);
      const engUids = (engRoles ?? []).map((r) => r.user_id);
      const allUids = [...new Set([...techUids, ...engUids])];

      const [{ data: clientProfiles }, { data: engProfiles }] =
        await Promise.all([
          allUids.length
            ? supabase
                .from("client_profiles")
                .select("user_id, contact_name, contact_email")
                .in("user_id", allUids)
            : Promise.resolve({ data: [] as { user_id: string; contact_name: string | null; contact_email: string | null }[] }),
          engUids.length
            ? supabase
                .from("engineer_profiles")
                .select("user_id, full_name")
                .in("user_id", engUids)
            : Promise.resolve({ data: [] as { user_id: string; full_name: string | null }[] }),
        ]);

      const contactMap = new Map(
        (clientProfiles ?? []).map((p) => [p.user_id, p])
      );
      const engNameMap = new Map(
        (engProfiles ?? []).map((p) => [p.user_id, p.full_name])
      );

      const resolveName = (uid: string, preferred?: string | null) => {
        const contact = contactMap.get(uid);
        return (
          preferred?.trim() ||
          contact?.contact_name?.trim() ||
          contact?.contact_email?.split("@")[0] ||
          uid.slice(0, 8)
        );
      };

      return {
        techs: techUids.map((uid) => ({
          user_id: uid,
          displayName: resolveName(uid),
        })),
        engineers: engUids.map((uid) => ({
          user_id: uid,
          displayName: resolveName(uid, engNameMap.get(uid)),
        })),
      };
    },
  });
}

export function usePartners() {
  return useQuery({
    queryKey: ["outsource-partners"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<OutsourcePartner[]> => {
      const { data, error } = await supabase
        .from("outsource_partners")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as OutsourcePartner[];
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations — each invalidates the shared "work-orders" cache prefix so the
// board, table, and detail page all refresh from one code path.

export function useInvalidateWorkOrders() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["work-orders"] });
}

export function useUpdateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Record<string, unknown>;
    }) => {
      // The generated Supabase types are stale (missing wo_number etc.), so
      // the patch is passed through untyped like the rest of the app does.
      const { error } = await supabase
        .from("work_orders")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-orders"] }),
  });
}

export function useBulkDispatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      technicianId,
      engineerId,
      scheduledDate,
    }: {
      ids: string[];
      technicianId: string;
      engineerId: string | null;
      scheduledDate: string | null;
    }) => {
      // Single set-based update, guarded against races on status.
      const { error } = await supabase
        .from("work_orders")
        .update({
          status: "dispatched",
          assigned_technician_id: technicianId,
          assigned_engineer_id: engineerId,
          scheduled_date: scheduledDate,
        })
        .in("id", ids)
        .eq("status", "pending_dispatch");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-orders"] }),
  });
}

export function useDeleteWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Best-effort cleanup of child rows (RLS allows admin).
      await supabase.from("field_data").delete().eq("work_order_id", id);
      await supabase.from("work_order_photos").delete().eq("work_order_id", id);
      await supabase.from("signed_documents").delete().eq("work_order_id", id);
      const { error } = await supabase.from("work_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-orders"] }),
  });
}

/**
 * Realtime: any change to work_orders invalidates the shared cache, throttled
 * so bursts (bulk dispatch, busy days) collapse into one refetch per 4s.
 */
export function useWorkOrdersRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let lastFetch = Date.now();
    let trailing: ReturnType<typeof setTimeout> | null = null;
    const invalidate = () =>
      qc.invalidateQueries({ queryKey: ["work-orders"] });
    const throttled = () => {
      const since = Date.now() - lastFetch;
      if (since >= 4000) {
        lastFetch = Date.now();
        invalidate();
      } else if (!trailing) {
        trailing = setTimeout(() => {
          trailing = null;
          lastFetch = Date.now();
          invalidate();
        }, 4000 - since);
      }
    };

    const channel = supabase
      .channel("admin-pipeline-cache")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_orders" },
        throttled
      )
      .subscribe();

    return () => {
      if (trailing) clearTimeout(trailing);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
