import { supabase } from "./supabase-client.js";

export async function requireStaff() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) { window.location.replace("index.html"); return null; }
  const { data: profile, error } = await supabase.from("profiles").select("id, full_name, role, is_active").eq("id", session.user.id).single();
  if (error || !profile?.is_active) { await supabase.auth.signOut(); window.location.replace("index.html"); return null; }
  document.querySelectorAll("[data-admin-only]").forEach(el => { el.hidden = profile.role !== "admin"; });
  const name = document.querySelector("#bcb-admin-user-name");
  const role = document.querySelector("#bcb-admin-user-role");
  if (name) name.textContent = profile.full_name || "BCB User";
  if (role) role.textContent = profile.role === "admin" ? "Administrator" : "Editor";
  document.querySelector("#bcb-admin-logout")?.addEventListener("click", async () => { await supabase.auth.signOut(); window.location.replace("index.html"); });
  return { session, profile };
}

export function esc(value = "") {
  return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

export function fmtDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value));
}

export { supabase };
