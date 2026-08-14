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

  if (usersLink && profile?.is_active && profile.role === "admin") {
    usersLink.hidden = false;
  }
}

syncAdminNavigation();