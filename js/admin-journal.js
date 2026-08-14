import { supabase } from "./supabase-client.js";

const params = new URLSearchParams(window.location.search);
const projectId = params.get("project");
let currentUser = null;
let currentProfile = null;
let entries = [];

const projectTitle = document.querySelector("#journal-project-title");
const backProject = document.querySelector("#journal-back-project");
const newEntryButton = document.querySelector("#journal-new-entry");
const closeFormButton = document.querySelector("#journal-close-form");
const formPanel = document.querySelector("#journal-form-panel");
const form = document.querySelector("#journal-form");
const entryIdInput = document.querySelector("#journal-entry-id");
const dateInput = document.querySelector("#journal-date");
const stageInput = document.querySelector("#journal-stage");
const teamInput = document.querySelector("#journal-team");
const hoursInput = document.querySelector("#journal-hours");
const summaryInput = document.querySelector("#journal-summary");
const issuesInput = document.querySelector("#journal-issues");
const materialsInput = document.querySelector("#journal-materials");
const weatherInput = document.querySelector("#journal-weather");
const mediaInput = document.querySelector("#journal-media");
const saveButton = document.querySelector("#journal-save");
const messageBox = document.querySelector("#journal-form-message");
const list = document.querySelector("#journal-list");
const logoutButton = document.querySelector("#bcb-admin-logout");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ro-RO", {
    day:"2-digit", month:"long", year:"numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function cleanFileName(value = "file") {
  const dot = value.lastIndexOf(".");
  const extension = dot >= 0 ? value.slice(dot).toLowerCase() : "";
  const base = dot >= 0 ? value.slice(0, dot) : value;
  const safe = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "media";
  return `${safe}${extension}`;
}

function showMessage(text, type = "success") {
  if (!messageBox) return;
  messageBox.hidden = false;
  messageBox.className = `bcb-project-message is-${type}`;
  messageBox.textContent = text;
}

function resetForm() {
  form?.reset();
  if (entryIdInput) entryIdInput.value = "";
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  if (messageBox) messageBox.hidden = true;
  if (saveButton) saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvează jurnalul';
}

function openForm(entry = null) {
  if (!formPanel) return;
  formPanel.hidden = false;

  if (!entry) {
    resetForm();
  } else {
    entryIdInput.value = entry.id;
    dateInput.value = entry.work_date || "";
    stageInput.value = entry.stage || "";
    teamInput.value = entry.team_members || "";
    hoursInput.value = entry.hours_worked ?? "";
    summaryInput.value = entry.work_summary || "";
    issuesInput.value = entry.issues_notes || "";
    materialsInput.value = entry.materials_needed || "";
    weatherInput.value = entry.weather || "";
    saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvează modificările';
  }

  formPanel.scrollIntoView({ behavior:"smooth", block:"start" });
}

async function requireStaffSession() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) {
    window.location.replace("index.html");
    return false;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", session.user.id)
    .single();

  if (error || !profile?.is_active) {
    await supabase.auth.signOut();
    window.location.replace("index.html");
    return false;
  }

  currentUser = session.user;
  currentProfile = profile;
  return true;
}

async function loadProject() {
  if (!projectId) {
    if (list) list.innerHTML = '<div class="bcb-journal-empty">Lipsește proiectul. Deschide jurnalul dintr-un proiect.</div>';
    if (newEntryButton) newEntryButton.disabled = true;
    return false;
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, title, current_stage")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    if (list) list.innerHTML = '<div class="bcb-journal-empty">Proiectul nu a putut fi încărcat.</div>';
    return false;
  }

  if (projectTitle) projectTitle.textContent = `Jurnal · ${project.title}`;
  if (backProject) backProject.href = `project.html?id=${encodeURIComponent(projectId)}`;
  if (stageInput && !stageInput.value) stageInput.value = project.current_stage || "";
  return true;
}

function mediaUrl(path) {
  return supabase.storage.from("project-media").getPublicUrl(path).data.publicUrl;
}

async function loadJournal() {
  const { data, error } = await supabase
    .from("site_journal_entries")
    .select("id, work_date, stage, team_members, hours_worked, work_summary, issues_notes, materials_needed, weather, created_at, project_media(id, media_type, storage_path)")
    .eq("project_id", projectId)
    .order("work_date", { ascending:false })
    .order("created_at", { ascending:false });

  if (error) {
    console.error(error);
    list.innerHTML = '<div class="bcb-journal-empty">Jurnalul nu a putut fi încărcat. Verifică dacă migrarea Supabase a fost rulată.</div>';
    return;
  }

  entries = data || [];

  if (!entries.length) {
    list.innerHTML = '<div class="bcb-journal-empty">Nu există încă activitate în jurnal. Apasă „Activitate nouă”.</div>';
    return;
  }

  list.innerHTML = entries.map(entry => {
    const media = entry.project_media || [];
    const mediaHtml = media.length ? `<div class="bcb-journal-media">${media.map(item => {
      const url = mediaUrl(item.storage_path);
      return item.media_type === "video"
        ? `<video src="${escapeHtml(url)}" controls preload="metadata" playsinline></video>`
        : `<img src="${escapeHtml(url)}" alt="Fotografie șantier" loading="lazy">`;
    }).join("")}</div>` : "";

    return `<article class="bcb-journal-card" data-entry-id="${escapeHtml(entry.id)}">
      <div class="bcb-journal-card-top">
        <div class="bcb-journal-card-date"><i class="fa-regular fa-calendar-check"></i><div><strong>${escapeHtml(formatDate(entry.work_date))}</strong><span>${escapeHtml(entry.stage || "Etapă nespecificată")}</span></div></div>
        <div class="bcb-journal-card-actions"><button class="bcb-journal-edit" data-action="edit" type="button" aria-label="Editează"><i class="fa-solid fa-pen"></i></button><button class="bcb-journal-delete" data-action="delete" type="button" aria-label="Șterge"><i class="fa-solid fa-trash"></i></button></div>
      </div>
      <div class="bcb-journal-meta">
        ${entry.team_members ? `<span><i class="fa-solid fa-users"></i> ${escapeHtml(entry.team_members)}</span>` : ""}
        ${entry.hours_worked !== null && entry.hours_worked !== undefined ? `<span><i class="fa-regular fa-clock"></i> ${escapeHtml(entry.hours_worked)} ore</span>` : ""}
        ${entry.weather ? `<span><i class="fa-solid fa-cloud-sun"></i> ${escapeHtml(entry.weather)}</span>` : ""}
      </div>
      <p class="bcb-journal-summary">${escapeHtml(entry.work_summary)}</p>
      ${entry.issues_notes ? `<div class="bcb-journal-block"><strong>Probleme / observații</strong><p>${escapeHtml(entry.issues_notes)}</p></div>` : ""}
      ${entry.materials_needed ? `<div class="bcb-journal-block"><strong>Materiale necesare</strong><p>${escapeHtml(entry.materials_needed)}</p></div>` : ""}
      ${mediaHtml}
    </article>`;
  }).join("");
}

async function uploadJournalMedia(entryId, files) {
  if (!files?.length) return;

  for (const file of files) {
    if (file.size > 500 * 1024 * 1024) continue;
    const mediaType = file.type.startsWith("video/") ? "video" : "image";
    const storagePath = `${projectId}/journal/${entryId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${cleanFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("project-media")
      .upload(storagePath, file, {
        cacheControl:"3600",
        upsert:false,
        contentType:file.type || undefined
      });

    if (uploadError) {
      console.error(uploadError);
      continue;
    }

    const { error: rowError } = await supabase
      .from("project_media")
      .insert({
        project_id:projectId,
        journal_entry_id:entryId,
        media_type:mediaType,
        storage_path:storagePath,
        title:file.name,
        stage:stageInput.value.trim() || null,
        uploaded_by:currentUser.id
      });

    if (rowError) {
      console.error(rowError);
      await supabase.storage.from("project-media").remove([storagePath]);
    }
  }
}

async function saveEntry(event) {
  event.preventDefault();
  if (!projectId || !summaryInput.value.trim()) return;

  saveButton.disabled = true;
  saveButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Se salvează…';

  const payload = {
    project_id:projectId,
    work_date:dateInput.value,
    stage:stageInput.value.trim() || null,
    team_members:teamInput.value.trim() || null,
    hours_worked:hoursInput.value ? Number(hoursInput.value) : null,
    work_summary:summaryInput.value.trim(),
    issues_notes:issuesInput.value.trim() || null,
    materials_needed:materialsInput.value.trim() || null,
    weather:weatherInput.value.trim() || null,
    updated_by:currentUser.id
  };

  let entryId = entryIdInput.value;
  let error = null;

  if (entryId) {
    ({ error } = await supabase.from("site_journal_entries").update(payload).eq("id", entryId));
  } else {
    const result = await supabase.from("site_journal_entries").insert({
      ...payload,
      created_by:currentUser.id
    }).select("id").single();
    error = result.error;
    if (!error) entryId = result.data.id;
  }

  if (error) {
    console.error(error);
    showMessage("Jurnalul nu a putut fi salvat.", "error");
    saveButton.disabled = false;
    saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvează jurnalul';
    return;
  }

  await uploadJournalMedia(entryId, mediaInput.files);

  showMessage("Activitatea a fost salvată. Pozele sunt disponibile și în Media proiectului.");
  saveButton.disabled = false;
  resetForm();
  formPanel.hidden = true;
  await loadJournal();
}

async function deleteEntry(entry) {
  if (!window.confirm(`Ștergi activitatea din ${formatDate(entry.work_date)}? Pozele asociate vor fi șterse și din Media.`)) return;

  const { data: media } = await supabase
    .from("project_media")
    .select("id, storage_path")
    .eq("journal_entry_id", entry.id);

  const paths = (media || []).map(item => item.storage_path).filter(Boolean);
  if (paths.length) await supabase.storage.from("project-media").remove(paths);
  if ((media || []).length) await supabase.from("project_media").delete().eq("journal_entry_id", entry.id);

  const { error } = await supabase.from("site_journal_entries").delete().eq("id", entry.id);
  if (error) {
    console.error(error);
    alert("Activitatea nu a putut fi ștearsă.");
    return;
  }

  await loadJournal();
}

newEntryButton?.addEventListener("click", () => openForm());
closeFormButton?.addEventListener("click", () => { formPanel.hidden = true; resetForm(); });
form?.addEventListener("submit", saveEntry);

list?.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  const card = event.target.closest("[data-entry-id]");
  if (!button || !card) return;
  const entry = entries.find(item => item.id === card.dataset.entryId);
  if (!entry) return;
  if (button.dataset.action === "edit") openForm(entry);
  if (button.dataset.action === "delete") deleteEntry(entry);
});

logoutButton?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.replace("index.html");
});

(async function init() {
  if (!(await requireStaffSession())) return;
  if (!(await loadProject())) return;
  resetForm();
  await loadJournal();
})();