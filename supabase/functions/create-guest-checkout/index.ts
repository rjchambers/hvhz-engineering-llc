import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const DESIGN_RAINFALL: Record<string, number> = {
  "Miami-Dade": 8.85, "Broward": 8.39, "Palm Beach": 8.10,
  "Monroe": 8.50, "Collier": 7.80,
};

// Server-side price catalog — mirrors src/components/order/orderServices.ts.
// The client's amount is only a cross-check; this is what gets charged.
const SERVICE_CATALOG: Record<string, { base: number; perSquare: number }> = {
  "tas-105": { base: 450, perSquare: 2.5 },
  "tas-106": { base: 250, perSquare: 0 },
  "tas-126": { base: 450, perSquare: 2.5 },
  "drainage-analysis": { base: 400, perSquare: 0 },
  "fastener-calculation": { base: 250, perSquare: 0 },
  "special-inspection": { base: 250, perSquare: 0 },
  "wind-mitigation-permit": { base: 250, perSquare: 0 },
  "asbestos-survey": { base: 425, perSquare: 2.5 },
  "other": { base: 0, perSquare: 0 },
};

const MOBILIZATION_FEE = 85;
const SAME_DAY_FEE = 75;
const REPORT_FEE = 20;
const MAX_DISTANCE_FEE = 50;

function discountPct(serviceCount: number): number {
  if (serviceCount >= 4) return 15;
  if (serviceCount === 3) return 10;
  if (serviceCount === 2) return 5;
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      services, serviceNames, customerEmail, customerName, clientId,
      jobAddress, jobCity, jobZip, jobCounty, jobLat, jobLng,
      gatedCommunity, gateCode, insideAccessName, insideAccessPhone,
      roofAreaSqft, roofHeightFt, sameDayDispatch, orderReport, distanceFee,
      clientAmount, roofReportPath, roofReportName, roofReportType,
      additionalDocs, orderDetails,
    } = body;

    if (!services?.length || !customerEmail) {
      return json({ error: "Missing services or customerEmail" }, 400);
    }

    // Validate the caller's token; the authenticated user is authoritative.
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claims } = await supabase.auth.getClaims(token);
      userId = claims?.claims?.sub || null;
    }

    const effectiveClientId = userId || clientId;
    if (!effectiveClientId) {
      return json({
        error: "An account is required to place an order. Please sign in or create an account before checking out.",
      }, 400);
    }

    // ── Server-side pricing (never trust the browser's total) ──────────
    const area = Math.max(0, Number(roofAreaSqft) || 0);
    const roofHeight = Math.max(0, Number(roofHeightFt) || 0);
    let subtotal = 0;
    for (const svc of services as string[]) {
      const entry = SERVICE_CATALOG[svc];
      if (!entry) return json({ error: `Unknown service: ${svc}` }, 400);
      subtotal += entry.base + (entry.perSquare > 0 ? entry.perSquare * area : 0);
    }
    const pct = discountPct(services.length);
    const discountAmount = subtotal * (pct / 100);
    const mobilization = roofHeight > 24 ? MOBILIZATION_FEE : 0;
    const sameDayAmount = sameDayDispatch ? SAME_DAY_FEE : 0;
    const reportFee = orderReport ? REPORT_FEE : 0;
    const boundedDistanceFee = Math.min(Math.max(Number(distanceFee) || 0, 0), MAX_DISTANCE_FEE);
    const total = subtotal - discountAmount + mobilization + sameDayAmount + boundedDistanceFee + reportFee;
    const amountCents = Math.round(total * 100);

    if (amountCents < 100) {
      return json({ error: "Order total is below the minimum chargeable amount" }, 400);
    }
    if (clientAmount && Math.abs(clientAmount - amountCents) > 1) {
      console.warn("Client/server amount mismatch", { clientAmount, amountCents, services, area });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // ── Site context + rich order data ─────────────────────────────────
    const county = jobCounty || "";
    const rainfallRate = DESIGN_RAINFALL[county] || 8.39;
    const siteContext = {
      county,
      lat: jobLat ?? null,
      lng: jobLng ?? null,
      design_rainfall_rate: rainfallRate,
      rainfall_source: `NOAA Atlas 14, ${county || "Broward"} County, 1-hr 100-yr`,
      hvhz_constants: { V: 185, exposure_category: "C", Kd: 0.85, Ke: 1.0, Kzt: 1.0, is_hvhz: true },
      gated_community: gatedCommunity || false,
      gate_code: gateCode || "",
      inside_access_name: insideAccessName || "",
      inside_access_phone: insideAccessPhone || "",
    };

    // Everything the field techs and PEs need, preserved on the order itself
    // (previously this was stuffed into Stripe metadata and thrown away).
    const roofData = {
      ...(orderDetails ?? {}),
      additional_documents: Array.isArray(additionalDocs) ? additionalDocs : [],
      pricing: {
        subtotal,
        discount_pct: pct,
        discount_amount: discountAmount,
        mobilization_fee: mobilization,
        same_day_fee: sameDayAmount,
        report_order_fee: reportFee,
        distance_fee: boundedDistanceFee,
        total,
      },
      same_day_dispatch: !!sameDayDispatch,
      report_ordered: !!orderReport,
    };

    const orderRow = {
      client_id: effectiveClientId,
      services,
      job_address: jobAddress || "",
      job_city: jobCity || "",
      job_zip: jobZip || "",
      job_county: county,
      roof_area_sqft: area || null,
      roof_data: roofData,
      roof_report_path: roofReportPath || null,
      roof_report_name: roofReportName || null,
      roof_report_type: roofReportType || null,
      gated_community: siteContext.gated_community,
      gate_code: siteContext.gate_code,
      site_context: siteContext,
      distance_fee: boundedDistanceFee || null,
      total_amount: total,
    };

    // ── Payment bypass window (admin-configured) ───────────────────────
    const { data: bypassConfig } = await supabaseAdmin
      .from("app_config").select("value").eq("key", "payment_bypass_until").maybeSingle();
    const bypassActive = bypassConfig?.value && new Date(bypassConfig.value) > new Date();

    if (bypassActive) {
      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .insert({ ...orderRow, status: "paid" })
        .select("id")
        .single();
      if (orderErr || !order) {
        console.error("Order insert error:", orderErr);
        return json({ error: "Failed to create order" }, 500);
      }

      const { data: techConfig } = await supabaseAdmin
        .from("app_config").select("value").eq("key", "default_technician_id").maybeSingle();
      const { data: engConfig } = await supabaseAdmin
        .from("app_config").select("value").eq("key", "default_engineer_id").maybeSingle();
      const defaultTechId = techConfig?.value || null;
      const defaultEngId = engConfig?.value || null;

      await supabaseAdmin.from("work_orders").insert(
        (services as string[]).map((svc) => ({
          order_id: order.id,
          client_id: effectiveClientId,
          service_type: svc,
          status: defaultTechId ? "dispatched" : "pending_dispatch",
          assigned_technician_id: defaultTechId || null,
          assigned_engineer_id: defaultEngId || null,
          scheduled_date: defaultTechId ? new Date().toISOString().split("T")[0] : null,
        }))
      );

      return json({ skipPayment: true, checkoutUrl: null });
    }

    // ── Stripe flow: create the order first (pending_payment), then the
    // session referencing it. The webhook completes the order on payment. ──
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Stripe not configured" }, 500);

    const { data: pendingOrder, error: pendingErr } = await supabaseAdmin
      .from("orders")
      .insert({ ...orderRow, status: "pending_payment" })
      .select("id")
      .single();
    if (pendingErr || !pendingOrder) {
      console.error("Pending order insert error:", pendingErr);
      return json({ error: "Failed to create order" }, 500);
    }

    const appUrl = Deno.env.get("APP_URL") || "https://hvhz.us";
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("customer_email", customerEmail);
    params.append("success_url", `${appUrl}/order?status=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${appUrl}/order`);
    // Slim metadata: the order row already holds everything.
    params.append("metadata[orderId]", pendingOrder.id);
    params.append("metadata[clientId]", effectiveClientId);
    params.append("line_items[0][price_data][currency]", "usd");
    params.append(
      "line_items[0][price_data][product_data][name]",
      `HVHZ Engineering Services (${services.length} service${services.length > 1 ? "s" : ""})`
    );
    params.append("line_items[0][price_data][unit_amount]", String(amountCents));
    params.append("line_items[0][quantity]", "1");

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
      // Don't leave an orphaned pending order behind
      await supabaseAdmin.from("orders").delete().eq("id", pendingOrder.id);
      return json({ error: session.error?.message || "Stripe error" }, 500);
    }

    await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", pendingOrder.id);

    return json({ checkoutUrl: session.url });
  } catch (err) {
    console.error("create-guest-checkout error:", err);
    return json({ error: String(err) }, 500);
  }
});
