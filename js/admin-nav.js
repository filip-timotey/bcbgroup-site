import { supabase } from "./supabase-client.js";

const usersLink = document.querySelector("#bcb-admin-users-link");

function addProjectJournalLink() {
  const currentPath = window.location.pathname;
  if (!currentPath.endsWith("/admin/project.html") && !currentPath.endsWith("project.html")) return;

  const projectId = new URLSearchParams(window.location.search).get("id");
  if (!projectId) return;

  const nav = document.querySelector(".bcb-admin-nav");
  if (!nav || nav.querySelector("[data-project-journal-link]")) return;

  const projectsLink = [...nav.querySelectorAll("a")].find(link => link.textContent.trim().includes("Proiecte"));
  const journalLink = document.createElement("a");
  journalLink.href = `journal.html?project=${encodeURIComponent(projectId)}`;
  journalLink.dataset.projectJournalLink = "true";
  journalLink.innerHTML = '<i class="fa-solid fa-book-open"></i> Jurnal șantier';

  if (projectsLink?.nextSibling) {
    nav.insertBefore(journalLink, projectsLink.nextSibling);
  } else if (projectsLink) {
    nav.appendChild(journalLink);
  } else {
    nav.prepend(journalLink);
  }
}

function addAdminOnlyLinks(profile) {
  if (!profile?.is_active || profile.role !== "admin") return;

  if (usersLink) usersLink.hidden = false;

  const nav = document.querySelector(".bcb-admin-nav");
  if (!nav || nav.querySelector("[data-site-editor-link]") || window.location.pathname.endsWith("site-editor.html")) return;

  const link = document.createElement("a");
  link.href = "site-editor.html";
  link.dataset.siteEditorLink = "true";
  link.innerHTML = '<i class="fa-solid fa-pen-ruler"></i> Site Editor';

  const activityLink = [...nav.querySelectorAll("a")].find(item => item.textContent.trim().includes("Activitate"));
  const userLink = nav.querySelector("#bcb-admin-users-link");

  if (userLink) {
    nav.insertBefore(link, userLink);
  } else if (activityLink?.nextSibling) {
    nav.insertBefore(link, activityLink.nextSibling);
  } else {
    nav.appendChild(link);
  }
}

async function syncAdminNavigation() {
  addProjectJournalLink();

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.user.id)
    .single();

  addAdminOnlyLinks(profile);
}

syncAdminNavigation();
