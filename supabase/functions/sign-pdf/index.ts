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

    const { workOrderId, signedPdfUrl, peNotes, signingMethod } = await req.json();

    if (!workOrderId || !signedPdfUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        signed_at: new Date().toISOString(),
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
        status: "complete",
        signed_report_url: signedPdfUrl,
        signed_at: new Date().toISOString(),
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
