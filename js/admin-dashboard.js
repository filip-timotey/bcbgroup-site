import { supabase } from "./supabase-client.js";

const userName = document.querySelector("#bcb-admin-user-name");
const userRole = document.querySelector("#bcb-admin-user-role");
const projectsCount = document.querySelector("#bcb-admin-projects-count");
const activeCount = document.querySelector("#bcb-admin-active-count");
const completedCount = document.querySelector("#bcb-admin-completed-count");
const mediaCount = document.querySelector("#bcb-admin-media-count");
const projectsList = document.querySelector("#bcb-admin-projects-list");
const logoutButton = document.querySelector("#bcb-admin-logout");
const newProjectButton = document.querySelector(".bcb-admin-primary-action");
const usersLink = document.querySelector("#bcb-admin-users-link");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusLabel(status) {
  const labels = {
    draft: "Schiță",
    in_progress: "În desfășurare",
    completed: "Finalizat",
    archived: "Arhivat"
  };
  return labels[status] || status;
}

async function requireStaffSession() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;

  if (!session) {
    window.location.replace("index.html");
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", session.user.id)
    .single();

  if (error || !profile?.is_active) {
    await supabase.auth.signOut();
    window.location.replace("index.html");
    return null;
  }

  return { session, profile };
}

async function loadDashboard() {
  const access = await requireStaffSession();
  if (!access) return;

  const { profile } = access;

  if (userName) userName.textContent = profile.full_name || "BCB User";
  if (userRole) userRole.textContent = profile.role === "admin" ? "Administrator" : "Editor";
  if (usersLink && profile.role === "admin") usersLink.hidden = false;

  if (newProjectButton) {
    newProjectButton.disabled = false;
    newProjectButton.addEventListener("click", () => {
      window.location.href = "project.html";
    });
  }

  const [{ data: projects, error: projectsError }, { count: mediaTotal }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, location, status, progress, current_stage, published_at, updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("project_media")
      .select("id", { count: "exact", head: true })
  ]);

  if (projectsError) {
    if (projectsList) projectsList.innerHTML = '<div class="bcb-admin-empty">Nu am putut încărca proiectele.</div>';
    return;
  }

  const allProjects = projects || [];
  const activeProjects = allProjects.filter((project) => project.status === "in_progress").length;
  const completedProjects = allProjects.filter((project) => project.status === "completed").length;

  if (projectsCount) projectsCount.textContent = allProjects.length;
  if (activeCount) activeCount.textContent = activeProjects;
  if (completedCount) completedCount.textContent = completedProjects;
  if (mediaCount) mediaCount.textContent = mediaTotal || 0;

  if (!projectsList) return;

  if (!allProjects.length) {
    projectsList.innerHTML = `
      <div class="bcb-admin-empty">
        <div class="bcb-admin-empty-icon"><i class="fa-regular fa-folder-open"></i></div>
        <strong>Nu există încă proiecte.</strong>
        <span>Apasă „Proiect nou” pentru a crea primul proiect.</span>
      </div>`;
    return;
  }

  projectsList.innerHTML = allProjects.map((project) => `
    <article class="bcb-admin-project-row" data-project-id="${escapeHtml(project.id)}">
      <div class="bcb-admin-project-main">
        <div class="bcb-admin-project-mark"></div>
        <div>
          <h3>${escapeHtml(project.title)}</h3>
          <p>${escapeHtml(project.location || "Locație nespecificată")}</p>
        </div>
      </div>
      <div class="bcb-admin-project-stage"><span>Etapă</span><strong>${escapeHtml(project.current_stage || "—")}</strong></div>
      <div class="bcb-admin-project-progress">
        <div class="bcb-admin-progress-meta"><span>Progres</span><strong>${project.progress}%</strong></div>
        <div class="bcb-admin-progress-track"><span style="width:${Math.max(0, Math.min(100, project.progress))}%"></span></div>
      </div>
      <div class="bcb-admin-project-status is-${escapeHtml(project.status)}">${escapeHtml(statusLabel(project.status))}</div>
      <button class="bcb-admin-row-action" type="button" data-action="edit" aria-label="Editează proiectul"><i class="fa-solid fa-arrow-right"></i></button>
    </article>`).join("");
}

projectsList?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='edit']");
  const row = event.target.closest("[data-project-id]");
  if (!button || !row) return;
  window.location.href = `project.html?id=${encodeURIComponent(row.dataset.projectId)}`;
});

logoutButton?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.replace("index.html");
});

loadDashboard();
