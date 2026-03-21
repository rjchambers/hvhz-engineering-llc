import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_MAP: Record<string, string> = {
  "tas-105": "STRIPE_PRICE_TAS105",
  "tas-106": "STRIPE_PRICE_TAS106",
  "tas-124": "STRIPE_PRICE_TAS124",
  "tas-126": "STRIPE_PRICE_TAS126",
  "roof-inspection": "STRIPE_PRICE_ROOF_INSPECTION",
  "roof-certification": "STRIPE_PRICE_ROOF_CERT",
  "drainage-analysis": "STRIPE_PRICE_DRAINAGE",
  "special-inspection": "STRIPE_PRICE_SPECIAL_INSPECTION",
  "wind-mitigation-permit": "STRIPE_PRICE_WIND_MIT",
  "fastener-calculation": "STRIPE_PRICE_FASTENER",
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

    // Auth check
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

    const { services, clientId, jobAddress } = await req.json();

    if (!services?.length || !clientId) {
      return new Response(JSON.stringify({ error: "Missing services or clientId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lineItems = services.map((svc: string) => {
      const envVar = PRICE_MAP[svc];
      const priceId = envVar ? Deno.env.get(envVar) : null;
      if (!priceId) throw new Error(`Price not configured for service: ${svc}`);
      return { price: priceId, quantity: 1 };
    });

    const appUrl = Deno.env.get("APP_URL") || "https://hvhzengineering.com";

    // Create Stripe checkout session via API
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", `${appUrl}/portal/order-confirmed?session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${appUrl}/portal/new-order`);
    params.append("metadata[clientId]", clientId);
    params.append("metadata[services]", JSON.stringify(services));
    params.append("metadata[jobAddress]", jobAddress || "");

    lineItems.forEach((item: { price: string; quantity: number }, i: number) => {
      params.append(`line_items[${i}][price]`, item.price);
      params.append(`line_items[${i}][quantity]`, String(item.quantity));
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
