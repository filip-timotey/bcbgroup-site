import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const LONG_BAN = "876000h"; // ~100 years; reversible only by Owner.

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const callerClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: userData } = await callerClient.auth.getUser();
    if (!userData.user) return json({ error: "Sesiune invalidă." }, 401);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: caller } = await admin.from("profiles").select("id,role,is_active,is_owner,is_archived,full_name,email").eq("id", userData.user.id).single();
    if (!caller?.is_active || caller.is_archived || !(caller.role === "admin" || caller.is_owner)) return json({ error: "Acces administrativ necesar." }, 403);

    const archiveUser = async (targetId: string) => {
      const { error: authError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: LONG_BAN });
      if (authError) throw authError;
      const { error: profileError } = await admin.from("profiles").update({ is_active: false, is_archived: true, archived_at: new Date().toISOString(), archived_by: caller.id }).eq("id", targetId);
      if (profileError) {
        await admin.auth.admin.updateUserById(targetId, { ban_duration: "none" });
        throw profileError;
      }
    };

    const restoreUser = async (targetId: string) => {
      const { error: authError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: "none" });
      if (authError) throw authError;
      const { error: profileError } = await admin.from("profiles").update({ is_active: true, is_archived: false, archived_at: null, archived_by: null }).eq("id", targetId);
      if (profileError) throw profileError;
    };

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "request") {
      if (caller.is_owner) return json({ error: "Owner-ul nu are nevoie de aprobare." }, 400);
      const targetId = String(body.target_user_id || "");
      const operation = body.operation === "delete" ? "delete" : "deactivate";
      const reason = String(body.reason || "").trim();
      const { data: target } = await admin.from("profiles").select("id,is_owner,is_archived,full_name,email").eq("id", targetId).single();
      if (!target || target.is_owner || target.is_archived) return json({ error: "Contul nu poate fi ținta acestei cereri." }, 400);
      const { data, error } = await admin.from("user_access_requests").insert({ requester_id: caller.id, target_user_id: targetId, action: operation, reason, status: "pending" }).select("id").single();
      if (error) return json({ error: error.code === "23505" ? "Există deja o cerere în așteptare pentru această acțiune." : error.message }, 400);
      return json({ success: true, request_id: data.id });
    }

    if (action === "review") {
      if (!caller.is_owner) return json({ error: "Doar Owner-ul poate aproba sau respinge cereri." }, 403);
      const requestId = String(body.request_id || "");
      const decision = body.decision === "approved" ? "approved" : "rejected";
      const { data: request } = await admin.from("user_access_requests").select("*").eq("id", requestId).eq("status", "pending").single();
      if (!request) return json({ error: "Cererea nu mai este disponibilă." }, 404);
      const { data: target } = await admin.from("profiles").select("id,is_owner,is_archived,full_name,email").eq("id", request.target_user_id).single();
      if (!target || target.is_owner) return json({ error: "Contul Owner este protejat." }, 400);

      if (decision === "rejected") {
        await admin.from("user_access_requests").update({ status: "rejected", reviewed_by: caller.id, reviewed_at: new Date().toISOString() }).eq("id", requestId);
        return json({ success: true, status: "rejected" });
      }

      if (request.action === "deactivate") {
        const { error } = await admin.from("profiles").update({ is_active: false }).eq("id", target.id);
        if (error) throw error;
      } else if (request.action === "delete") {
        await archiveUser(target.id);
      }
      await admin.from("user_access_requests").update({ status: "executed", reviewed_by: caller.id, reviewed_at: new Date().toISOString(), executed_at: new Date().toISOString() }).eq("id", requestId);
      return json({ success: true, status: "executed" });
    }

    if (action === "owner_execute") {
      if (!caller.is_owner) return json({ error: "Doar Owner-ul poate executa direct această acțiune." }, 403);
      const targetId = String(body.target_user_id || "");
      const operation = String(body.operation || "");
      const { data: target } = await admin.from("profiles").select("id,is_owner,is_active,is_archived").eq("id", targetId).single();
      if (!target || target.is_owner || target.id === caller.id) return json({ error: "Acest cont este protejat." }, 400);

      if (operation === "deactivate") {
        const { error } = await admin.from("profiles").update({ is_active: false }).eq("id", targetId);
        if (error) throw error;
      } else if (operation === "reactivate") {
        if (target.is_archived) await restoreUser(targetId);
        else {
          const { error } = await admin.from("profiles").update({ is_active: true }).eq("id", targetId);
          if (error) throw error;
        }
      } else if (operation === "delete") {
        await archiveUser(targetId);
      } else {
        return json({ error: "Acțiune invalidă." }, 400);
      }
      return json({ success: true, archived: operation === "delete" });
    }

    return json({ error: "Acțiune necunoscută." }, 400);
  } catch (error) {
    console.error("manage-bcb-user", error);
    return json({ error: error instanceof Error ? error.message : "Eroare internă." }, 500);
  }
});
