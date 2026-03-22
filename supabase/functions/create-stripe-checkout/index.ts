import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SERVICE_CATALOG: Record<string, { name: string; base: number; perSquare: number }> = {
  "tas-105": { name: "TAS-105 Fastener Withdrawal Test", base: 450, perSquare: 2.5 },
  "tas-106": { name: "TAS-106 Tile Bonding Verification", base: 200, perSquare: 0 },
  "tas-126": { name: "TAS-126 Moisture Survey", base: 450, perSquare: 2.5 },
  "drainage": { name: "Roof Drainage Calculations", base: 400, perSquare: 0 },
  "enhanced-fastener": { name: "Enhanced Fastener Pattern", base: 250, perSquare: 0 },
  "special-inspection": { name: "Special Inspections", base: 250, perSquare: 0 },
  "wind-mitigation": { name: "Wind Mitigation (Roofing Permit)", base: 250, perSquare: 0 },
  "asbestos-survey": { name: "Asbestos Survey", base: 425, perSquare: 2.5 },
};

const DESIGN_RAINFALL: Record<string, number> = {
  "Miami-Dade": 8.85, "Broward": 8.39, "Palm Beach": 8.10,
  "Monroe": 8.50, "Collier": 7.80,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      services, clientId, jobAddress,
      jobCity, jobZip, jobCounty,
      gatedCommunity, gateCode,
      noaDocumentPath, noaDocumentName,
      roofReportPath, roofReportName, roofReportType,
      otherServiceDetails, roofAreaSqft,
    } = await req.json();

    if (!services?.length || !clientId) {
      return new Response(JSON.stringify({ error: "Missing services or clientId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out "other" (no charge) from chargeable services
    const chargeableServices = services.filter((s: string) => s !== "other");

    if (chargeableServices.length === 0) {
      return new Response(JSON.stringify({ skipPayment: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check payment bypass
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: bypassConfig } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", "payment_bypass_until")
      .maybeSingle();

    const bypassActive = bypassConfig?.value && new Date(bypassConfig.value) > new Date();

    if (bypassActive) {
      // Create order and work orders directly, skipping Stripe
      const county = jobCounty || "";
      const rainfallRate = DESIGN_RAINFALL[county] || 8.39;
      const siteContext = {
        county,
        design_rainfall_rate: rainfallRate,
        rainfall_source: `NOAA Atlas 14, ${county || "Broward"} County, 1-hr 100-yr`,
        hvhz_constants: { V: 185, exposure_category: "C", Kd: 0.85, Ke: 1.0, Kzt: 1.0, is_hvhz: true },
        gated_community: gatedCommunity || false,
        gate_code: gateCode || "",
      };

      const area = Number(roofAreaSqft) || 0;
      let totalAmount = 0;
      chargeableServices.forEach((svc: string) => {
        const catalog = SERVICE_CATALOG[svc];
        if (catalog) totalAmount += catalog.base + (catalog.perSquare > 0 ? catalog.perSquare * area : 0);
      });

      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .insert({
          client_id: clientId,
          services: chargeableServices,
          job_address: jobAddress || "",
          job_city: jobCity || "",
          job_zip: jobZip || "",
          job_county: county,
          noa_document_path: noaDocumentPath || null,
          noa_document_name: noaDocumentName || null,
          roof_report_path: roofReportPath || null,
          roof_report_name: roofReportName || null,
          roof_report_type: roofReportType || null,
          gated_community: siteContext.gated_community,
          gate_code: siteContext.gate_code,
          site_context: siteContext,
          total_amount: totalAmount,
          status: "paid",
        })
        .select("id")
        .single();

      if (orderErr) {
        console.error("Order insert error:", orderErr);
        return new Response(JSON.stringify({ error: "Failed to create order" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch default assignments
      const { data: techConfig } = await supabaseAdmin
        .from("app_config").select("value").eq("key", "default_technician_id").maybeSingle();
      const { data: engConfig } = await supabaseAdmin
        .from("app_config").select("value").eq("key", "default_engineer_id").maybeSingle();
      const defaultTechId = techConfig?.value || null;
      const defaultEngId = engConfig?.value || null;

      const workOrderInserts = chargeableServices.map((svc: string) => ({
        order_id: order.id,
        client_id: clientId,
        service_type: svc,
        status: defaultTechId ? "dispatched" : "pending_dispatch",
        assigned_technician_id: defaultTechId || null,
        assigned_engineer_id: defaultEngId || null,
        scheduled_date: defaultTechId ? new Date().toISOString().split("T")[0] : null,
      }));

      await supabaseAdmin.from("work_orders").insert(workOrderInserts);

      return new Response(JSON.stringify({ skipPayment: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normal Stripe flow
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = Deno.env.get("APP_URL") || "https://hvhzengineering.com";

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", `${appUrl}/portal/order-confirmed?session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${appUrl}/portal/new-order`);
    params.append("metadata[clientId]", clientId);
    params.append("metadata[services]", JSON.stringify(services));
    params.append("metadata[jobAddress]", jobAddress || "");
    params.append("metadata[jobCity]", jobCity || "");
    params.append("metadata[jobZip]", jobZip || "");
    params.append("metadata[jobCounty]", jobCounty || "");
    params.append("metadata[gatedCommunity]", String(gatedCommunity || false));
    params.append("metadata[gateCode]", gateCode || "");
    params.append("metadata[noaDocumentPath]", noaDocumentPath || "");
    params.append("metadata[noaDocumentName]", noaDocumentName || "");
    params.append("metadata[roofReportPath]", roofReportPath || "");
    params.append("metadata[roofReportName]", roofReportName || "");
    params.append("metadata[roofReportType]", roofReportType || "");
    if (otherServiceDetails) {
      params.append("metadata[otherServiceDetails]", otherServiceDetails.slice(0, 500));
    }

    const area = Number(roofAreaSqft) || 0;
    chargeableServices.forEach((svc: string, i: number) => {
      const catalog = SERVICE_CATALOG[svc];
      if (!catalog) throw new Error(`Unknown service: ${svc}`);
      const unitPrice = catalog.base + (catalog.perSquare > 0 ? catalog.perSquare * area : 0);
      params.append(`line_items[${i}][price_data][currency]`, "usd");
      params.append(`line_items[${i}][price_data][product_data][name]`, catalog.name);
      params.append(`line_items[${i}][price_data][unit_amount]`, String(Math.round(unitPrice * 100)));
      params.append(`line_items[${i}][quantity]`, "1");
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error("Stripe error:", session);
      return new Response(JSON.stringify({ error: session.error?.message || "Stripe error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ checkoutUrl: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-stripe-checkout error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
