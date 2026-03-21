import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.split("=")[1]);

  if (!timestamp || signatures.length === 0) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signatures.includes(computed);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not set");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const body = await req.text();
    const sigHeader = req.headers.get("stripe-signature");

    if (!sigHeader) {
      return new Response("Missing stripe-signature", { status: 400 });
    }

    const valid = await verifyStripeSignature(body, sigHeader, webhookSecret);
    if (!valid) {
      console.error("Invalid stripe signature");
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);

    if (event.type !== "checkout.session.completed") {
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    const session = event.data.object;
    const clientId = session.metadata?.clientId;
    const services: string[] = JSON.parse(session.metadata?.services || "[]");
    const jobAddress = session.metadata?.jobAddress || "";
    const totalAmount = (session.amount_total || 0) / 100;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Create order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        client_id: clientId,
        stripe_session_id: session.id,
        services,
        job_address: jobAddress,
        total_amount: totalAmount,
        status: "pending_dispatch",
      })
      .select("id")
      .single();

    if (orderErr) {
      console.error("Order insert error:", orderErr);
      return new Response("Failed to create order", { status: 500 });
    }

    // Create work orders
    const workOrderInserts = services.map((svc: string) => ({
      order_id: order.id,
      client_id: clientId,
      service_type: svc,
      status: "pending_dispatch",
    }));

    const { error: woErr } = await supabase.from("work_orders").insert(workOrderInserts);
    if (woErr) {
      console.error("Work orders insert error:", woErr);
    }

    // Send confirmation email
    const { data: clientProfile } = await supabase
      .from("client_profiles")
      .select("contact_email, contact_name")
      .eq("user_id", clientId)
      .maybeSingle();

    if (clientProfile?.contact_email) {
      const supabasePublicUrl = Deno.env.get("SUPABASE_URL")!;
      try {
        await fetch(`${supabasePublicUrl}/functions/v1/send-notification-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: "order_confirmed",
            recipientEmail: clientProfile.contact_email,
            recipientName: clientProfile.contact_name,
            extraData: { services: services.join(", ") },
          }),
        });
      } catch (emailErr) {
        console.error("Email send failed:", emailErr);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-webhook error:", err);
    return new Response(String(err), { status: 500 });
  }
});
