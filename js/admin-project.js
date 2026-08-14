import { supabase } from "./supabase-client.js";

const params = new URLSearchParams(window.location.search);
let projectId = params.get("id");
let currentUser = null;
let currentProfile = null;

const form = document.querySelector("#bcb-project-form");
const titleInput = document.querySelector("#project-title");
const locationInput = document.querySelector("#project-location");
const stageInput = document.querySelector("#project-stage");
const statusInput = document.querySelector("#project-status");
const progressInput = document.querySelector("#project-progress");
const progressValue = document.querySelector("#project-progress-value");
const shortDescriptionInput = document.querySelector("#project-short-description");
const descriptionInput = document.querySelector("#project-description");
const saveButton = document.querySelector("#bcb-project-save");
const messageBox = document.querySelector("#bcb-project-message");
const pageTitle = document.querySelector("#bcb-project-page-title");
const heading = document.querySelector("#bcb-project-heading");
const mediaPanel = document.querySelector("#bcb-media-panel");
const mediaInput = document.querySelector("#bcb-media-input");
const mediaGrid = document.querySelector("#bcb-media-grid");
const uploadStatus = document.querySelector("#bcb-media-upload-status");
const logoutButton = document.querySelector("#bcb-admin-logout");
const dangerZone = document.querySelector("#bcb-project-danger-zone");
const deleteProjectButton = document.querySelector("#bcb-project-delete");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function cleanFileName(value = "file") {
  const dot = value.lastIndexOf(".");
  const extension = dot >= 0 ? value.slice(dot).toLowerCase() : "";
  const base = dot >= 0 ? value.slice(0, dot) : value;
  return `${slugify(base) || "media"}${extension}`;
}

function showMessage(text, type = "success") {
  if (!messageBox) return;
  messageBox.hidden = false;
  messageBox.className = `bcb-project-message is-${type}`;
  messageBox.textContent = text;
}

function setBusy(isBusy) {
  if (!saveButton) return;
  saveButton.disabled = isBusy;
  saveButton.innerHTML = isBusy
    ? '<i class="fa-solid fa-circle-notch fa-spin"></i> Se salvează…'
    : '<i class="fa-solid fa-floppy-disk"></i> Salvează proiectul';
}

function updateAdminControls() {
  if (!dangerZone) return;
  dangerZone.hidden = !(currentProfile?.role === "admin" && projectId);
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
  updateAdminControls();
  return true;
}

async function loadProject() {
  if (!projectId) {
    if (mediaPanel) mediaPanel.hidden = true;
    updateAdminControls();
    return;
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    showMessage("Proiectul nu a putut fi încărcat.", "error");
    return;
  }

  titleInput.value = project.title || "";
  locationInput.value = project.location || "";
  stageInput.value = project.current_stage || "";
  statusInput.value = project.status || "draft";
  progressInput.value = Number(project.progress || 0);
  progressValue.textContent = `${progressInput.value}%`;
  shortDescriptionInput.value = project.short_description || "";
  descriptionInput.value = project.description || "";

  if (pageTitle) pageTitle.textContent = project.title;
  if (heading) heading.textContent = project.title;
  if (mediaPanel) mediaPanel.hidden = false;

  updateAdminControls();
  await loadMedia();
}

async function saveProject(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  if (!title) {
    showMessage("Titlul proiectului este obligatoriu.", "error");
    return;
  }

  setBusy(true);

  const status = statusInput.value;
  const publicStatus = status === "in_progress" || status === "completed";

  const payload = {
    title,
    location: locationInput.value.trim() || null,
    short_description: shortDescriptionInput.value.trim() || null,
    description: descriptionInput.value.trim() || null,
    status,
    progress: Number(progressInput.value || 0),
    current_stage: stageInput.value.trim() || null,
    updated_by: currentUser.id,
    published_at: publicStatus ? new Date().toISOString() : null
  };

  let error;

  if (projectId) {
    ({ error } = await supabase
      .from("projects")
      .update(payload)
      .eq("id", projectId));
  } else {
    const result = await supabase
      .from("projects")
      .insert({
        ...payload,
        slug: `${slugify(title) || "proiect"}-${Date.now().toString(36)}`,
        created_by: currentUser.id
      })
      .select("id")
      .single();

    error = result.error;
    if (!error) projectId = result.data.id;
  }

  setBusy(false);

  if (error) {
    console.error(error);
    showMessage("Nu am putut salva proiectul. Încearcă din nou.", "error");
    return;
  }

  showMessage(
    publicStatus
      ? "Proiect salvat și publicat. Va apărea automat pe site."
      : "Proiect salvat ca schiță și ascuns de pe site."
  );

  if (pageTitle) pageTitle.textContent = title;
  if (heading) heading.textContent = title;
  if (mediaPanel) mediaPanel.hidden = false;

  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}?id=${encodeURIComponent(projectId)}`
  );

  updateAdminControls();
  await loadMedia();
}

function mediaPublicUrl(path) {
  return supabase.storage.from("project-media").getPublicUrl(path).data.publicUrl;
}

async function loadMedia() {
  if (!projectId || !mediaGrid) return;

  const { data: media, error } = await supabase
    .from("project_media")
    .select("id, media_type, storage_path, title, is_cover, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    mediaGrid.innerHTML = '<div class="bcb-admin-empty">Nu am putut încărca media.</div>';
    return;
  }

  const items = media || [];

  if (!items.length) {
    mediaGrid.innerHTML = '<div class="bcb-admin-empty">Nu există încă fișiere media.</div>';
    return;
  }

  mediaGrid.innerHTML = items.map((item) => {
    const url = mediaPublicUrl(item.storage_path);
    const preview = item.media_type === "video"
      ? `<video src="${escapeHtml(url)}" muted playsinline controls preload="metadata"></video>`
      : `<img src="${escapeHtml(url)}" alt="Media proiect" loading="lazy">`;

    return `<article class="bcb-media-card" data-media-id="${escapeHtml(item.id)}" data-storage-path="${escapeHtml(item.storage_path)}">
      <div class="bcb-media-preview">${preview}</div>
      <div class="bcb-media-card-footer">
        ${item.media_type === "image"
          ? `<button class="bcb-media-cover ${item.is_cover ? "is-active" : ""}" type="button" data-action="cover">${item.is_cover ? "Copertă" : "Setează copertă"}</button>`
          : '<span>Video</span>'}
        <button class="bcb-media-delete" type="button" data-action="delete" aria-label="Șterge"><i class="fa-solid fa-trash"></i></button>
      </div>
    </article>`;
  }).join("");
}

async function uploadFiles(files) {
  if (!projectId || !files?.length) return;

  uploadStatus.hidden = false;
  mediaInput.disabled = true;

  let uploaded = 0;
  let failed = 0;

  for (const file of files) {
    if (file.size > 500 * 1024 * 1024) {
      failed += 1;
      continue;
    }

    const mediaType = file.type.startsWith("video/") ? "video" : "image";
    const storagePath = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${cleanFileName(file.name)}`;

    uploadStatus.textContent = `Se încarcă ${uploaded + failed + 1} din ${files.length}: ${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("project-media")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined
      });

    if (uploadError) {
      console.error(uploadError);
      failed += 1;
      continue;
    }

    const { error: rowError } = await supabase
      .from("project_media")
      .insert({
        project_id: projectId,
        media_type: mediaType,
        storage_path: storagePath,
        title: file.name,
        uploaded_by: currentUser.id
      });

    if (rowError) {
      console.error(rowError);
      await supabase.storage.from("project-media").remove([storagePath]);
      failed += 1;
      continue;
    }

    uploaded += 1;
  }

  mediaInput.value = "";
  mediaInput.disabled = false;
  uploadStatus.textContent = failed
    ? `${uploaded} încărcate, ${failed} nereușite.`
    : `${uploaded} fișier(e) încărcate cu succes.`;

  await loadMedia();
}

async function removeMedia(card) {
  const mediaId = card.dataset.mediaId;
  const storagePath = card.dataset.storagePath;

  if (!mediaId || !storagePath || !window.confirm("Ștergi definitiv acest fișier?")) {
    return;
  }

  const { error: storageError } = await supabase.storage
    .from("project-media")
    .remove([storagePath]);

  if (storageError) {
    showMessage("Fișierul nu a putut fi șters.", "error");
    return;
  }

  const { error } = await supabase
    .from("project_media")
    .delete()
    .eq("id", mediaId);

  if (error) {
    showMessage("Înregistrarea media nu a putut fi ștearsă.", "error");
    return;
  }

  await supabase
    .from("projects")
    .update({ cover_path: null, updated_by: currentUser.id })
    .eq("id", projectId)
    .eq("cover_path", storagePath);

  await loadMedia();
}

async function setCover(card) {
  const mediaId = card.dataset.mediaId;
  const storagePath = card.dataset.storagePath;

  if (!mediaId || !storagePath) return;

  await supabase
    .from("project_media")
    .update({ is_cover: false })
    .eq("project_id", projectId);

  const { error: mediaError } = await supabase
    .from("project_media")
    .update({ is_cover: true })
    .eq("id", mediaId);

  const { error: projectError } = await supabase
    .from("projects")
    .update({ cover_path: storagePath, updated_by: currentUser.id })
    .eq("id", projectId);

  if (mediaError || projectError) {
    showMessage("Coperta nu a putut fi setată.", "error");
    return;
  }

  await loadMedia();
}

async function deleteCurrentProject() {
  if (!projectId || currentProfile?.role !== "admin") return;

  const projectName = titleInput?.value.trim() || "acest proiect";
  const confirmed = window.confirm(
    `Ștergi definitiv „${projectName}”?\n\nVor fi șterse și toate fotografiile și videoclipurile proiectului. Acțiunea nu poate fi anulată.`
  );

  if (!confirmed) return;

  deleteProjectButton.disabled = true;
  deleteProjectButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Se șterge…';

  const { data: mediaItems, error: mediaReadError } = await supabase
    .from("project_media")
    .select("storage_path")
    .eq("project_id", projectId);

  if (mediaReadError) {
    console.error(mediaReadError);
    showMessage("Nu am putut verifica fișierele proiectului. Ștergerea a fost oprită.", "error");
    deleteProjectButton.disabled = false;
    deleteProjectButton.innerHTML = '<i class="fa-solid fa-trash-can"></i> Șterge proiectul complet';
    return;
  }

  const storagePaths = (mediaItems || [])
    .map((item) => item.storage_path)
    .filter(Boolean);

  if (storagePaths.length) {
    const { error: storageError } = await supabase.storage
      .from("project-media")
      .remove(storagePaths);

    if (storageError) {
      console.error(storageError);
      showMessage("Nu am putut șterge toate fișierele media. Proiectul a fost păstrat pentru siguranță.", "error");
      deleteProjectButton.disabled = false;
      deleteProjectButton.innerHTML = '<i class="fa-solid fa-trash-can"></i> Șterge proiectul complet';
      return;
    }
  }

  const { error: deleteError } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (deleteError) {
    console.error(deleteError);
    showMessage("Proiectul nu a putut fi șters. Încearcă din nou.", "error");
    deleteProjectButton.disabled = false;
    deleteProjectButton.innerHTML = '<i class="fa-solid fa-trash-can"></i> Șterge proiectul complet';
    return;
  }

  window.location.replace("dashboard.html?deleted=1");
}

progressInput?.addEventListener("input", () => {
  progressValue.textContent = `${progressInput.value}%`;
});

form?.addEventListener("submit", saveProject);

mediaInput?.addEventListener("change", () => {
  uploadFiles([...mediaInput.files]);
});

mediaGrid?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  const card = event.target.closest(".bcb-media-card");

  if (!button || !card) return;

  if (button.dataset.action === "delete") await removeMedia(card);
  if (button.dataset.action === "cover") await setCover(card);
});

deleteProjectButton?.addEventListener("click", deleteCurrentProject);

logoutButton?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.replace("index.html");
});

(async function init() {
  if (await requireStaffSession()) {
    await loadProject();
  }
})();
