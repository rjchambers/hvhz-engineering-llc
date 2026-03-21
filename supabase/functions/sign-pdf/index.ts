import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify engineer role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "engineer")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: engineer role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { workOrderId, signedPdfUrl, peNotes, signingMethod } = await req.json();

    if (!workOrderId || !signedPdfUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify work order exists and is assigned to this engineer
    const { data: wo, error: woErr } = await supabaseAdmin
      .from("work_orders")
      .select("id, assigned_engineer_id, client_id, service_type, orders(job_address)")
      .eq("id", workOrderId)
      .single();

    if (woErr || !wo) {
      return new Response(JSON.stringify({ error: "Work order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (wo.assigned_engineer_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not assigned to this work order" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    // Insert signed_documents record
    const { error: insertErr } = await supabaseAdmin.from("signed_documents").upsert(
      {
        work_order_id: workOrderId,
        signed_by: user.id,
        signed_pdf_url: signedPdfUrl,
        signing_method: signingMethod || "image-stamp",
        pe_notes: peNotes,
        fac_rule_ref: "FAC 61G15-23.004",
        is_cryptographically_signed: false,
        signed_at: now,
      },
      { onConflict: "work_order_id" }
    );

    if (insertErr) {
      console.error("Insert signed_documents error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to save signed document" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update work order status
    const { error: updateErr } = await supabaseAdmin
      .from("work_orders")
      .update({
        status: "signed",
        signed_report_url: signedPdfUrl,
        signed_at: now,
        pe_notes: peNotes,
      })
      .eq("id", workOrderId);

    if (updateErr) {
      console.error("Update work_orders error:", updateErr);
      return new Response(JSON.stringify({ error: "Failed to update work order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send client notification email
    const { data: clientProfile } = await supabaseAdmin
      .from("client_profiles")
      .select("contact_email, contact_name")
      .eq("user_id", wo.client_id)
      .maybeSingle();

    if (clientProfile?.contact_email) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: "report_complete",
            recipientEmail: clientProfile.contact_email,
            recipientName: clientProfile.contact_name,
            extraData: {
              serviceType: wo.service_type,
              jobAddress: (wo.orders as any)?.job_address ?? "",
              workOrderId,
            },
          }),
        });
      } catch (emailErr) {
        console.error("Email notification failed:", emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sign-pdf error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
