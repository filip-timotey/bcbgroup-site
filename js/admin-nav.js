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

function ensureNavLink(nav, href, icon, label, beforeElement = null) {
  const existing = [...nav.querySelectorAll("a")].find(a => (a.getAttribute("href") || "").split("?")[0] === href);
  if (existing) { existing.hidden = false; return existing; }
  const link = document.createElement("a");
  link.href = href;
  link.innerHTML = `<i class="fa-solid ${icon}"></i> ${label}`;
  if (beforeElement) nav.insertBefore(link, beforeElement);
  else nav.appendChild(link);
  return link;
}

function addCommonLinks() {
  const nav = document.querySelector(".bcb-admin-nav");
  if (!nav) return;
  const activity = [...nav.querySelectorAll("a")].find(a => (a.getAttribute("href") || "") === "activity.html");
  const fleet = ensureNavLink(nav, "fleet.html", "fa-car-side", "Fleet", activity?.nextSibling || null);
  const current = window.location.pathname.split("/").pop();
  if (current === "fleet.html") fleet.classList.add("active");
}

function addAdminOnlyLinks(profile) {
  if (!profile?.is_active || profile.role !== "admin") return;
  const nav = document.querySelector(".bcb-admin-nav");
  if (!nav) return;

  nav.querySelectorAll("#bcb-admin-users-link,[data-admin-only]").forEach(el => { el.hidden = false; });
  const userLink = [...nav.querySelectorAll("a")].find(a => (a.getAttribute("href") || "") === "users.html");
  ensureNavLink(nav, "site-editor.html", "fa-pen-ruler", "Site Editor", userLink || null);
  ensureNavLink(nav, "settings.html", "fa-sliders", "Setări site", userLink || null);
  const dataControl = ensureNavLink(nav, "data-control.html", "fa-database", "Control date", userLink || null);
  if (window.location.pathname.endsWith("data-control.html")) dataControl.classList.add("active");
}

function setupMobileDrawer() {
  const sidebar = document.querySelector(".bcb-admin-sidebar");
  if (!sidebar || document.querySelector(".bcb-mobile-admin-bar")) return;

  const bar = document.createElement("div");
  bar.className = "bcb-mobile-admin-bar";
  bar.innerHTML = `
    <div class="bcb-mobile-admin-brand">
      <img src="../assets/images/logo.png" alt="BCB Group">
      <span><small>BCB Group</small><strong>Business Manager</strong></span>
    </div>
    <button class="bcb-mobile-admin-menu" type="button" aria-label="Deschide meniul" aria-expanded="false">
      <i class="fa-solid fa-bars"></i>
    </button>`;

  const overlay = document.createElement("div");
  overlay.className = "bcb-mobile-admin-overlay";
  document.body.append(bar, overlay);

  const button = bar.querySelector(".bcb-mobile-admin-menu");
  const icon = button.querySelector("i");

  const open = () => {
    sidebar.classList.add("is-mobile-open");
    overlay.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
    icon.className = "fa-solid fa-xmark";
    document.body.style.overflow = "hidden";
  };
  const close = () => {
    sidebar.classList.remove("is-mobile-open");
    overlay.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
    icon.className = "fa-solid fa-bars";
    document.body.style.overflow = "";
  };

  button.addEventListener("click", () => sidebar.classList.contains("is-mobile-open") ? close() : open());
  overlay.addEventListener("click", close);
  sidebar.querySelectorAll("a").forEach(a => a.addEventListener("click", close));
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  window.addEventListener("resize", () => { if (window.innerWidth > 620) close(); });
}

async function syncAdminNavigation() {
  addProjectJournalLink();
  addCommonLinks();
  setupMobileDrawer();

  if (window.location.pathname.endsWith("site-editor.html")) {
    import("./admin-site-editor-video.js").catch(error => console.error("Site Editor video controls:", error));
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return;
  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", session.user.id).single();
  addAdminOnlyLinks(profile);

  if (profile?.role === "admin" && window.location.pathname.endsWith("fleet.html")) {
    import("./admin-fleet-delete.js").catch(error => console.error("Fleet delete controls:", error));
  }
}

syncAdminNavigation();
