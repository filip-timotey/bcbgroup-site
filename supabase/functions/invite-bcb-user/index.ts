import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Sesiune invalidă." }, 401);
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: callerProfile } = await adminClient.from("profiles").select("role,is_active,is_owner").eq("id", userData.user.id).single();
    if (!callerProfile?.is_active || !(callerProfile.role === "admin" || callerProfile.is_owner)) return json({ error: "Doar administratorii pot invita utilizatori." }, 403);
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const role = body.role === "admin" ? "admin" : "editor";
    if (!email || !email.includes("@")) return json({ error: "Adresa de email nu este validă." }, 400);
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName || email }, redirectTo: "https://bcbgroup.ro/admin/set-password.html" });
    if (inviteError || !invited.user) return json({ error: inviteError?.message || "Invitația nu a putut fi trimisă." }, 400);
    const { error: profileError } = await adminClient.from("profiles").upsert({ id: invited.user.id, email, full_name: fullName || email, role, is_active: true }, { onConflict: "id" });
    if (profileError) return json({ error: "Utilizatorul a fost invitat, dar profilul nu a putut fi actualizat." }, 500);
    return json({ success: true });
  } catch (error) {
    console.error("invite-bcb-user", error);
    return json({ error: "Eroare internă la invitarea utilizatorului." }, 500);
  }
});
