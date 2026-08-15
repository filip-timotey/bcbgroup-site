import { supabase } from "./supabase-client.js";

function addProjectJournalLink() {
  const currentPath = window.location.pathname;
  if (!currentPath.endsWith("/admin/project.html") && !currentPath.endsWith("project.html")) return;
  const projectId = new URLSearchParams(window.location.search).get("id");
  if (!projectId) return;

  const nav = document.querySelector(".bcb-admin-nav");
  if (!nav || nav.querySelector("[data-project-journal-link]")) return;
  const projectsLink = [...nav.querySelectorAll("a")].find(link => link.textContent.trim().includes("Proiecte"));
  const link = document.createElement("a");
  link.href = `journal.html?project=${encodeURIComponent(projectId)}`;
  link.dataset.projectJournalLink = "true";
  link.innerHTML = '<i class="fa-solid fa-book-open"></i> Jurnal șantier';
  if (projectsLink?.nextSibling) nav.insertBefore(link, projectsLink.nextSibling);
  else nav.appendChild(link);
}

function ensureNavLink(nav, href, icon, label, beforeElement) {
  const existing = [...nav.querySelectorAll("a")].find(a => (a.getAttribute("href") || "").split("?")[0] === href);
  if (existing) { existing.hidden = false; return existing; }
  const link = document.createElement("a");
  link.href = href;
  link.innerHTML = `<i class="fa-solid ${icon}"></i> ${label}`;
  if (beforeElement) nav.insertBefore(link, beforeElement);
  else nav.appendChild(link);
  return link;
}

function addFleetLink() {
  const nav = document.querySelector(".bcb-admin-nav");
  if (!nav) return;
  const userLink = [...nav.querySelectorAll("a")].find(a => (a.getAttribute("href") || "") === "users.html");
  const settingsLink = [...nav.querySelectorAll("a")].find(a => (a.getAttribute("href") || "") === "settings.html");
  const activityLink = [...nav.querySelectorAll("a")].find(a => (a.getAttribute("href") || "") === "activity.html");
  const before = settingsLink || userLink || activityLink?.nextSibling || null;
  ensureNavLink(nav, "fleet.html", "fa-car-side", "Fleet", before);
}

function addAdminOnlyLinks(profile) {
  if (!profile?.is_active || profile.role !== "admin") return;
  const nav = document.querySelector(".bcb-admin-nav");
  if (!nav) return;

  nav.querySelectorAll("#bcb-admin-users-link,[data-admin-only]").forEach(el => { el.hidden = false; });
  const userLink = [...nav.querySelectorAll("a")].find(a => (a.getAttribute("href") || "") === "users.html");
  ensureNavLink(nav, "site-editor.html", "fa-pen-ruler", "Site Editor", userLink || null);
  ensureNavLink(nav, "settings.html", "fa-sliders", "Setări site", userLink || null);
}

async function syncAdminNavigation() {
  addProjectJournalLink();
  addFleetLink();
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return;
  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", session.user.id).single();
  addAdminOnlyLinks(profile);
}

syncAdminNavigation();
