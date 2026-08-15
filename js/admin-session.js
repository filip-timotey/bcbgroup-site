import { supabase } from "./supabase-client.js";

let staffContextPromise = null;
let logoutBound = false;

async function resolveStaffContext() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const session = sessionData.session;
  if (!session) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .eq("id", session.user.id)
    .single();

  if (profileError || !profile?.is_active) {
    await supabase.auth.signOut();
    return null;
  }

  return { session, profile };
}

export function getStaffContext() {
  if (!staffContextPromise) {
    staffContextPromise = resolveStaffContext().catch((error) => {
      staffContextPromise = null;
      throw error;
    });
  }
  return staffContextPromise;
}

export async function requireStaffContext({ adminOnly = false, redirect = true } = {}) {
  let context = null;
  try {
    context = await getStaffContext();
  } catch (error) {
    console.error("BCB session error:", error);
  }

  if (!context) {
    if (redirect) window.location.replace("index.html");
    return null;
  }

  if (adminOnly && context.profile.role !== "admin") {
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
    try {
      await supabase.auth.signOut();
    } finally {
      staffContextPromise = null;
      window.location.replace("index.html");
    }
  });
}

export function invalidateStaffContext() {
  staffContextPromise = null;
}
