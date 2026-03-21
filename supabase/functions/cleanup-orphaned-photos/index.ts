import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

  // List all objects in field-photos bucket
  const { data: storageObjects } = await admin.storage.from("field-photos").list("work_orders", { limit: 1000, offset: 0 });
  // Get all referenced storage_paths from DB
  const { data: dbPaths } = await admin.from("work_order_photos").select("storage_path");
  const referenced = new Set((dbPaths ?? []).map((r: any) => r.storage_path));

  // Find orphans
  const orphans: string[] = [];
  for (const obj of storageObjects ?? []) {
    const path = `work_orders/${obj.name}`;
    if (!referenced.has(path)) orphans.push(path);
  }

  let deleted = 0;
  if (orphans.length > 0) {
    await admin.storage.from("field-photos").remove(orphans);
    deleted = orphans.length;
  }

  return new Response(JSON.stringify({ orphansFound: orphans.length, deleted }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
