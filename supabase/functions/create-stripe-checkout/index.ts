import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SERVICE_CATALOG: Record<string, { name: string; price: number }> = {
  "tas-105": { name: "TAS-105 Fastener Withdrawal Test", price: 450 },
  "tas-106": { name: "TAS-106 Tile Bonding Verification", price: 450 },
  "tas-126": { name: "TAS-126 Moisture Survey", price: 450 },
  "drainage-analysis": { name: "Drainage Analysis", price: 550 },
  "special-inspection": { name: "Special Inspection", price: 400 },
  "wind-mitigation-permit": { name: "Wind Mitigation (Roofing Permit)", price: 500 },
  "fastener-calculation": { name: "Fastener Uplift Calculation", price: 350 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      otherServiceDetails,
    } = await req.json();

    if (!services?.length || !clientId) {
      return new Response(JSON.stringify({ error: "Missing services or clientId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = Deno.env.get("APP_URL") || "https://hvhzengineering.com";

    // Build line items using price_data (no pre-created Price IDs needed)
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

    services.forEach((svc: string, i: number) => {
      const catalog = SERVICE_CATALOG[svc];
      if (!catalog) throw new Error(`Unknown service: ${svc}`);
      params.append(`line_items[${i}][price_data][currency]`, "usd");
      params.append(`line_items[${i}][price_data][product_data][name]`, catalog.name);
      params.append(`line_items[${i}][price_data][unit_amount]`, String(catalog.price * 100));
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
