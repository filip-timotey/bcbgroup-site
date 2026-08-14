import { supabase } from "./supabase-client.js";

const usersLink = document.querySelector("#bcb-admin-users-link");

async function syncAdminNavigation() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;

  if (!session) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.user.id)
    .single();

  if (usersLink && profile?.is_active && profile.role === "admin") {
    usersLink.hidden = false;
  }
}

syncAdminNavigation();
