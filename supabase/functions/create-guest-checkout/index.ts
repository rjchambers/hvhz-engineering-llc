import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
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

    const appUrl = Deno.env.get("APP_URL") || "https://hvhzengineering.com";

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("customer_email", customerEmail);
    params.append("success_url", `${appUrl}/order?status=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${appUrl}/order`);

    // Store all order data in metadata for the webhook
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

    // Single line item with the pre-calculated total
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
