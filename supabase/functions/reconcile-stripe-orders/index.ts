import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DESIGN_RAINFALL: Record<string, number> = {
  "Miami-Dade": 8.85, "Broward": 8.39, "Palm Beach": 8.10,
  "Monroe": 8.50, "Collier": 7.80,
};

interface ReconcileResult {
  session_id: string;
  status: "created" | "completed_pending" | "skipped_existing" | "skipped_unpaid" | "skipped_no_client" | "error";
  order_id?: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Admin auth check ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Params ----
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const days = Math.min(Math.max(Number(body.days ?? 7), 1), 30);
    const dryRun = Boolean(body.dryRun ?? false);
    const since = Math.floor(Date.now() / 1000) - days * 86400;

    // ---- Fetch Stripe sessions (paginate) ----
    const sessions: any[] = [];
    let starting_after: string | undefined;
    for (let i = 0; i < 10; i++) {
      const params = new URLSearchParams({
        limit: "100",
        "created[gte]": String(since),
      });
      if (starting_after) params.set("starting_after", starting_after);
      const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions?${params}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: `Stripe error: ${await resp.text()}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const json = await resp.json();
      sessions.push(...json.data);
      if (!json.has_more) break;
      starting_after = json.data[json.data.length - 1]?.id;
    }

    // ---- Existing orders for these sessions (id + status so we can finish
    // pre-created pending_payment orders whose webhook never landed) ----
    const sessionIds = sessions.map((s) => s.id);
    const { data: existing } = await admin
      .from("orders")
      .select("id, stripe_session_id, status, client_id, services")
      .in("stripe_session_id", sessionIds);
    const existingBySession = new Map(
      (existing || []).map((r) => [r.stripe_session_id as string, r])
    );

    // ---- Default assignments ----
    const { data: techConfig } = await admin
      .from("app_config").select("value").eq("key", "default_technician_id").maybeSingle();
    const { data: engConfig } = await admin
      .from("app_config").select("value").eq("key", "default_engineer_id").maybeSingle();
    const defaultTechId = techConfig?.value || null;
    const defaultEngId = engConfig?.value || null;

    const results: ReconcileResult[] = [];

    // Finish a pre-created order that paid but never got its webhook:
    // flip the status and create work orders if none exist.
    const completePendingOrder = async (
      order: { id: string; client_id: string; services: string[] },
      session: { id: string; amount_total?: number; customer?: string }
    ) => {
      await admin.from("orders").update({
        status: "pending_dispatch",
        stripe_session_id: session.id,
        total_amount: (session.amount_total || 0) / 100,
      }).eq("id", order.id);

      if (session.customer) {
        await admin.from("client_profiles")
          .update({ stripe_customer_id: session.customer })
          .eq("user_id", order.client_id).is("stripe_customer_id", null);
      }

      const { count: woCount } = await admin
        .from("work_orders")
        .select("id", { count: "exact", head: true })
        .eq("order_id", order.id);
      if (!woCount) {
        const { error: woErr } = await admin.from("work_orders").insert(
          order.services.map((svc) => ({
            order_id: order.id,
            client_id: order.client_id,
            service_type: svc,
            status: defaultTechId ? "dispatched" : "pending_dispatch",
            assigned_technician_id: defaultTechId,
            assigned_engineer_id: defaultEngId,
            scheduled_date: defaultTechId ? new Date().toISOString().split("T")[0] : null,
          }))
        );
        if (woErr) throw woErr;
      }
    };

    for (const session of sessions) {
      if (session.payment_status !== "paid") {
        results.push({ session_id: session.id, status: "skipped_unpaid" });
        continue;
      }

      const existingOrder = existingBySession.get(session.id);
      if (existingOrder) {
        if (existingOrder.status === "pending_payment") {
          if (dryRun) {
            results.push({ session_id: session.id, status: "completed_pending", order_id: "(dry-run)" });
          } else {
            try {
              await completePendingOrder(existingOrder, session);
              results.push({ session_id: session.id, status: "completed_pending", order_id: existingOrder.id });
            } catch (e: any) {
              results.push({ session_id: session.id, status: "error", error: String(e?.message || e) });
            }
          }
        } else {
          results.push({ session_id: session.id, status: "skipped_existing" });
        }
        continue;
      }

      // Pre-created order whose stripe_session_id update failed — find by id.
      if (session.metadata?.orderId) {
        const { data: byId } = await admin
          .from("orders")
          .select("id, status, client_id, services")
          .eq("id", session.metadata.orderId)
          .maybeSingle();
        if (byId?.status === "pending_payment") {
          if (dryRun) {
            results.push({ session_id: session.id, status: "completed_pending", order_id: "(dry-run)" });
          } else {
            try {
              await completePendingOrder(byId, session);
              results.push({ session_id: session.id, status: "completed_pending", order_id: byId.id });
            } catch (e: any) {
              results.push({ session_id: session.id, status: "error", error: String(e?.message || e) });
            }
          }
        } else {
          results.push({ session_id: session.id, status: byId ? "skipped_existing" : "skipped_no_client" });
        }
        continue;
      }

      const clientId = session.metadata?.clientId || session.metadata?.userId;
      if (!clientId) {
        results.push({ session_id: session.id, status: "skipped_no_client" });
        continue;
      }

      if (dryRun) {
        results.push({ session_id: session.id, status: "created", order_id: "(dry-run)" });
        continue;
      }

      try {
        const services: string[] = JSON.parse(session.metadata?.services || "[]");
        const county = session.metadata?.jobCounty || "";
        const rainfallRate = DESIGN_RAINFALL[county] || 8.39;
        const siteContext = {
          county,
          lat: session.metadata?.jobLat ? parseFloat(session.metadata.jobLat) : null,
          lng: session.metadata?.jobLng ? parseFloat(session.metadata.jobLng) : null,
          design_rainfall_rate: rainfallRate,
          rainfall_source: `NOAA Atlas 14, ${county || "Broward"} County, 1-hr 100-yr`,
          hvhz_constants: {
            V: 185, exposure_category: "C", Kd: 0.85, Ke: 1.0, Kzt: 1.0, is_hvhz: true,
          },
          gated_community: session.metadata?.gatedCommunity === "true",
          gate_code: session.metadata?.gateCode || "",
          inside_access_name: session.metadata?.insideAccessName || "",
          inside_access_phone: session.metadata?.insideAccessPhone || "",
        };

        if (session.customer) {
          await admin.from("client_profiles")
            .update({ stripe_customer_id: session.customer })
            .eq("user_id", clientId).is("stripe_customer_id", null);
        }

        const { data: order, error: orderErr } = await admin.from("orders").insert({
          client_id: clientId,
          stripe_session_id: session.id,
          services,
          job_address: session.metadata?.jobAddress || "",
          job_city: session.metadata?.jobCity || "",
          job_zip: session.metadata?.jobZip || "",
          job_county: county,
          noa_document_path: session.metadata?.noaDocumentPath || null,
          noa_document_name: session.metadata?.noaDocumentName || null,
          roof_report_path: session.metadata?.roofReportPath || null,
          roof_report_name: session.metadata?.roofReportName || null,
          roof_report_type: session.metadata?.roofReportType || null,
          gated_community: siteContext.gated_community,
          gate_code: siteContext.gate_code,
          site_context: siteContext,
          total_amount: (session.amount_total || 0) / 100,
          status: "pending_dispatch",
        }).select("id").single();

        if (orderErr) throw orderErr;

        const workOrderInserts = services.map((svc) => ({
          order_id: order.id,
          client_id: clientId,
          service_type: svc,
          status: defaultTechId ? "dispatched" : "pending_dispatch",
          assigned_technician_id: defaultTechId,
          assigned_engineer_id: defaultEngId,
          scheduled_date: defaultTechId ? new Date().toISOString().split("T")[0] : null,
        }));
        const { error: woErr } = await admin.from("work_orders").insert(workOrderInserts);
        if (woErr) throw woErr;

        results.push({ session_id: session.id, status: "created", order_id: order.id });
      } catch (e: any) {
        results.push({ session_id: session.id, status: "error", error: String(e?.message || e) });
      }
    }

    const summary = {
      days, dryRun,
      scanned: sessions.length,
      created: results.filter((r) => r.status === "created").length,
      completed_pending: results.filter((r) => r.status === "completed_pending").length,
      skipped_existing: results.filter((r) => r.status === "skipped_existing").length,
      skipped_unpaid: results.filter((r) => r.status === "skipped_unpaid").length,
      skipped_no_client: results.filter((r) => r.status === "skipped_no_client").length,
      errors: results.filter((r) => r.status === "error").length,
    };

    return new Response(JSON.stringify({ summary, results }, null, 2), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("reconcile-stripe-orders error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
