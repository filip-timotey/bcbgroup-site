import { supabase } from "./supabase-client.js";

let staffContextPromise = null;
let logoutBound = false;

function isInvalidRefreshToken(error) {
  const code = String(error?.code || "").toLowerCase();
  const text = String(error?.message || "").toLowerCase();
  return code.includes("refresh_token_not_found") || text.includes("invalid refresh token") || text.includes("refresh token not found");
}

async function clearBrokenLocalSession(error) {
  if (!isInvalidRefreshToken(error)) return false;
  try { await supabase.auth.signOut({ scope: "local" }); } catch (_) {}
  staffContextPromise = null;
  return true;
}

async function resolveStaffContext() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    await clearBrokenLocalSession(sessionError);
    throw sessionError;
  }
  const session = sessionData.session;
  if (!session) return null;
  const { data: trusted, error: userError } = await supabase.auth.getUser();
  if (userError || !trusted?.user) {
    if (userError) await clearBrokenLocalSession(userError);
    throw userError || new Error("Sesiunea nu a putut fi verificată.");
  }
  const { data: profile, error: profileError } = await supabase.from("profiles").select("id, full_name, email, role, is_active, is_owner, avatar_path").eq("id", trusted.user.id).single();
  if (profileError) throw profileError;
  if (!profile?.is_active) {
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }
  return { session, profile };
}

export function isOwnerProfile(profile) { return Boolean(profile?.is_owner); }
export function isAdminProfile(profile) { return Boolean(profile?.is_owner || profile?.role === "admin"); }

export function getStaffContext() {
  if (!staffContextPromise) {
    staffContextPromise = resolveStaffContext().catch((error) => {
      staffContextPromise = null;
      throw error;
    });
  }
  return staffContextPromise;
}

export async function requireStaffContext({ adminOnly = false, ownerOnly = false, redirect = true } = {}) {
  let context = null;
  try { context = await getStaffContext(); }
  catch (error) { console.error("BCB session error:", error); }
  if (!context) {
    if (redirect) window.location.replace("index.html?session=recover");
    return null;
  }
  if (ownerOnly && !isOwnerProfile(context.profile)) {
    if (redirect) window.location.replace("dashboard.html");
    return null;
  }
  if (adminOnly && !isAdminProfile(context.profile)) {
    if (redirect) window.location.replace("dashboard.html");
    return null;
  }
  return context;
}

export function bindAdminLogout() {
  if (logoutBound) return;
  const button = document.querySelector("#bcb-admin-logout");
  if (!button) return;
  logoutBound = true;
  button.addEventListener("click", async () => {
    button.disabled = true;
    try { await supabase.auth.signOut(); }
    finally { staffContextPromise = null; window.location.replace("index.html"); }
  });
}

export function invalidateStaffContext() { staffContextPromise = null; }
