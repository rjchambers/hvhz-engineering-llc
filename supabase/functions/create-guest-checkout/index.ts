import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DESIGN_RAINFALL: Record<string, number> = {
  "Miami-Dade": 8.85, "Broward": 8.39, "Palm Beach": 8.10,
  "Monroe": 8.50, "Collier": 7.80,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      services,
      serviceNames,
      customerEmail,
      customerName,
      amount,
      clientId,
      jobAddress,
      jobCity,
      jobZip,
      jobCounty,
      gatedCommunity,
      gateCode,
      metadata,
      isGuestOrder,
    } = body;

    if (!services?.length || !customerEmail) {
      return new Response(
        JSON.stringify({ error: "Missing services or customerEmail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!amount || amount < 100) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If authenticated, validate token
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ") && !isGuestOrder) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claims } = await supabase.auth.getClaims(token);
      userId = claims?.claims?.sub || null;
    }

    // Check payment bypass
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: bypassConfig } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", "payment_bypass_until")
      .maybeSingle();

    const bypassActive = bypassConfig?.value && new Date(bypassConfig.value) > new Date();

    if (bypassActive) {
      // Create order and work orders directly
      const effectiveClientId = clientId || userId;
      const county = jobCounty || "";
      const rainfallRate = DESIGN_RAINFALL[county] || 8.39;
      const siteContext = {
        county,
        lat: jobLat || null,
        lng: jobLng || null,
        design_rainfall_rate: rainfallRate,
        rainfall_source: `NOAA Atlas 14, ${county || "Broward"} County, 1-hr 100-yr`,
        hvhz_constants: { V: 185, exposure_category: "C", Kd: 0.85, Ke: 1.0, Kzt: 1.0, is_hvhz: true },
        gated_community: gatedCommunity || false,
        gate_code: gateCode || "",
      };

      const totalAmount = (amount || 0) / 100;

      // For guest orders without a clientId, create a placeholder
      if (!effectiveClientId) {
        return new Response(JSON.stringify({ error: "Guest orders require payment — bypass not available without an account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .insert({
          client_id: effectiveClientId,
          services,
          job_address: jobAddress || "",
          job_city: jobCity || "",
          job_zip: jobZip || "",
          job_county: county,
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

      const workOrderInserts = services.map((svc: string) => ({
        order_id: order.id,
        client_id: effectiveClientId,
        service_type: svc,
        status: defaultTechId ? "dispatched" : "pending_dispatch",
        assigned_technician_id: defaultTechId || null,
        assigned_engineer_id: defaultEngId || null,
        scheduled_date: defaultTechId ? new Date().toISOString().split("T")[0] : null,
      }));

      await supabaseAdmin.from("work_orders").insert(workOrderInserts);

      return new Response(JSON.stringify({ skipPayment: true, checkoutUrl: null }), {
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
    params.append("customer_email", customerEmail);
    params.append("success_url", `${appUrl}/order?status=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${appUrl}/order`);

    params.append("metadata[services]", JSON.stringify(services));
    params.append("metadata[serviceNames]", JSON.stringify(serviceNames || []));
    params.append("metadata[customerEmail]", customerEmail);
    params.append("metadata[customerName]", customerName || "");
    params.append("metadata[jobAddress]", jobAddress || "");
    params.append("metadata[jobCity]", jobCity || "");
    params.append("metadata[jobZip]", jobZip || "");
    params.append("metadata[jobCounty]", jobCounty || "");
    params.append("metadata[gatedCommunity]", String(gatedCommunity || false));
    params.append("metadata[gateCode]", gateCode || "");
    params.append("metadata[isGuestOrder]", String(!!isGuestOrder));
    params.append("metadata[userId]", userId || "");
    if (metadata) {
      params.append("metadata[orderMetadata]", typeof metadata === "string" ? metadata : JSON.stringify(metadata));
    }

    params.append("line_items[0][price_data][currency]", "usd");
    params.append("line_items[0][price_data][product_data][name]",
      `HVHZ Engineering Services (${services.length} service${services.length > 1 ? "s" : ""})`
    );
    params.append("line_items[0][price_data][unit_amount]", String(amount));
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
      return new Response(
        JSON.stringify({ error: session.error?.message || "Stripe error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ checkoutUrl: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-guest-checkout error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
