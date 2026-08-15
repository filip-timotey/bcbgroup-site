import { requireStaffContext, bindAdminLogout } from "./admin-session.js";

function addProjectJournalLink() {
  const currentPath = window.location.pathname;
  if (!currentPath.endsWith("/admin/project.html") && !currentPath.endsWith("project.html")) return;
  const projectId = new URLSearchParams(window.location.search).get("id");
  if (!projectId) return;

  const nav = document.querySelector(".bcb-admin-nav");
  if (!nav || nav.querySelector("[data-project-journal-link]")) return;
  const projectsLink = [...nav.querySelectorAll("a")].find((link) => link.textContent.trim().includes("Proiecte"));
  const link = document.createElement("a");
  link.href = `journal.html?project=${encodeURIComponent(projectId)}`;
  link.dataset.projectJournalLink = "true";
  link.innerHTML = '<i class="fa-solid fa-book-open"></i> Jurnal șantier';
  if (projectsLink?.nextSibling) nav.insertBefore(link, projectsLink.nextSibling);
  else nav.appendChild(link);
}

function ensureNavLink(nav, href, icon, label, beforeElement = null) {
  const existing = [...nav.querySelectorAll("a")].find((a) => (a.getAttribute("href") || "").split("?")[0] === href);
  if (existing) {
    existing.hidden = false;
    return existing;
  }
  const link = document.createElement("a");
  link.href = href;
  link.innerHTML = `<i class="fa-solid ${icon}"></i> ${label}`;
  if (beforeElement) nav.insertBefore(link, beforeElement);
  else nav.appendChild(link);
  return link;
}

function setActiveLink(link, page) {
  if (!link) return;
  link.classList.toggle("active", window.location.pathname.endsWith(page));
}

function addCommonLinks() {
  const nav = document.querySelector(".bcb-admin-nav");
  if (!nav) return;
  const activity = [...nav.querySelectorAll("a")].find((a) => (a.getAttribute("href") || "") === "activity.html");
  const fleet = ensureNavLink(nav, "fleet.html", "fa-car-side", "Fleet", activity?.nextSibling || null);
  setActiveLink(fleet, "fleet.html");
}

function addAdminOnlyLinks(profile) {
  if (!profile?.is_active || profile.role !== "admin") return;
  const nav = document.querySelector(".bcb-admin-nav");
  if (!nav) return;

  nav.querySelectorAll("#bcb-admin-users-link,[data-admin-only]").forEach((element) => { element.hidden = false; });
  const userLink = [...nav.querySelectorAll("a")].find((a) => (a.getAttribute("href") || "") === "users.html");
  const siteEditor = ensureNavLink(nav, "site-editor.html", "fa-pen-ruler", "Site Editor", userLink || null);
  const settings = ensureNavLink(nav, "settings.html", "fa-sliders", "Setări site", userLink || null);
  const dataControl = ensureNavLink(nav, "data-control.html", "fa-database", "Control date", userLink || null);

  setActiveLink(siteEditor, "site-editor.html");
  setActiveLink(settings, "settings.html");
  setActiveLink(dataControl, "data-control.html");
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
  let openState = false;

  const setOpen = (next) => {
    if (openState === next) return;
    openState = next;
    sidebar.classList.toggle("is-mobile-open", next);
    overlay.classList.toggle("is-open", next);
    button.setAttribute("aria-expanded", String(next));
    icon.className = next ? "fa-solid fa-xmark" : "fa-solid fa-bars";
    document.body.style.overflow = next ? "hidden" : "";
  };

  button.addEventListener("click", () => setOpen(!openState));
  overlay.addEventListener("click", () => setOpen(false));
  sidebar.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 620) setOpen(false);
  }, { passive: true });
}

async function syncAdminNavigation() {
  addProjectJournalLink();
  addCommonLinks();
  setupMobileDrawer();
  bindAdminLogout();

  if (window.location.pathname.endsWith("site-editor.html")) {
    import("./admin-site-editor-video.js").catch((error) => console.error("Site Editor video controls:", error));
  }

  const context = await requireStaffContext();
  if (!context) return;
  addAdminOnlyLinks(context.profile);

  if (context.profile.role === "admin" && window.location.pathname.endsWith("fleet.html")) {
    import("./admin-fleet-delete.js").catch((error) => console.error("Fleet delete controls:", error));
  }
}

syncAdminNavigation();
