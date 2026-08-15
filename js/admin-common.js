import "./admin-nav.js";
import { supabase } from "./supabase-client.js";
import { requireStaffContext, bindAdminLogout } from "./admin-session.js";

export async function requireStaff() {
  const context = await requireStaffContext();
  if (!context) return null;

  const { profile } = context;
  document.querySelectorAll("[data-admin-only]").forEach((element) => {
    element.hidden = profile.role !== "admin";
  });

  const name = document.querySelector("#bcb-admin-user-name");
  const role = document.querySelector("#bcb-admin-user-role");
  if (name) name.textContent = profile.full_name || "BCB User";
  if (role) role.textContent = profile.role === "admin" ? "Administrator" : "Editor";

  bindAdminLogout();
  return context;
}

export function esc(value = "") {
  return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

export function fmtDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value));
}

export { supabase };
