import "./admin-nav.js";
import { supabase } from "./supabase-client.js";
import { requireStaffContext, bindAdminLogout } from "./admin-session.js";

const userName = document.querySelector("#bcb-admin-user-name");
const userRole = document.querySelector("#bcb-admin-user-role");
const projectsCount = document.querySelector("#bcb-admin-projects-count");
const activeCount = document.querySelector("#bcb-admin-active-count");
const completedCount = document.querySelector("#bcb-admin-completed-count");
const mediaCount = document.querySelector("#bcb-admin-media-count");
const projectsList = document.querySelector("#bcb-admin-projects-list");
const newProjectButton = document.querySelector(".bcb-admin-primary-action");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusLabel(status) {
  const labels = { draft:"Schiță", in_progress:"În desfășurare", completed:"Finalizat", archived:"Arhivat" };
  return labels[status] || status;
}

async function loadDashboard() {
  const access = await requireStaffContext();
  if (!access) return;
  bindAdminLogout();

  const { profile } = access;
  if (userName) userName.textContent = profile.full_name || "BCB User";
  if (userRole) userRole.textContent = profile.role === "admin" ? "Administrator" : "Editor";

  if (newProjectButton && !newProjectButton.dataset.bound) {
    newProjectButton.dataset.bound = "true";
    newProjectButton.disabled = false;
    newProjectButton.addEventListener("click", () => { window.location.href = "project.html"; });
  }

  const [{ data: projects, error: projectsError }, { count: mediaTotal }] = await Promise.all([
    supabase.from("projects").select("id, title, location, status, progress, current_stage, published_at, updated_at").order("updated_at", { ascending:false }),
    supabase.from("project_media").select("id", { count:"exact", head:true })
  ]);

  if (projectsError) {
    if (projectsList) projectsList.innerHTML = '<div class="bcb-admin-empty">Nu am putut încărca proiectele.</div>';
    return;
  }

  const allProjects = projects || [];
  if (projectsCount) projectsCount.textContent = allProjects.length;
  if (activeCount) activeCount.textContent = allProjects.filter(p=>p.status==="in_progress").length;
  if (completedCount) completedCount.textContent = allProjects.filter(p=>p.status==="completed").length;
  if (mediaCount) mediaCount.textContent = mediaTotal || 0;
  if (!projectsList) return;

  if (!allProjects.length) {
    projectsList.innerHTML = '<div class="bcb-admin-empty"><div class="bcb-admin-empty-icon"><i class="fa-regular fa-folder-open"></i></div><strong>Nu există încă proiecte.</strong><span>Apasă „Proiect nou” pentru a crea primul proiect.</span></div>';
    return;
  }

  projectsList.innerHTML = allProjects.map(project => `<article class="bcb-admin-project-row" data-project-id="${escapeHtml(project.id)}"><div class="bcb-admin-project-main"><div class="bcb-admin-project-mark"></div><div><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.location || "Locație nespecificată")}</p></div></div><div class="bcb-admin-project-stage"><span>Etapă</span><strong>${escapeHtml(project.current_stage || "—")}</strong></div><div class="bcb-admin-project-progress"><div class="bcb-admin-progress-meta"><span>Progres</span><strong>${project.progress}%</strong></div><div class="bcb-admin-progress-track"><span style="width:${Math.max(0,Math.min(100,project.progress))}%"></span></div></div><div class="bcb-admin-project-status is-${escapeHtml(project.status)}">${escapeHtml(statusLabel(project.status))}</div><button class="bcb-admin-row-action" type="button" data-action="edit" aria-label="Editează proiectul"><i class="fa-solid fa-arrow-right"></i></button></article>`).join("");
}

projectsList?.addEventListener("click", event => {
  const button = event.target.closest("button[data-action='edit']");
  const row = event.target.closest("[data-project-id]");
  if (!button || !row) return;
  window.location.href = `project.html?id=${encodeURIComponent(row.dataset.projectId)}`;
});

loadDashboard();
