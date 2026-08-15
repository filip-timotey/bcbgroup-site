import { supabase } from "./supabase-client.js";
import { SITE_EDITOR_FIELDS, SITE_EDITOR_PAGES } from "./site-editor-registry.js";

const tabs = document.querySelector("#site-editor-tabs");
const content = document.querySelector("#site-editor-content");
const previewLink = document.querySelector("#site-editor-preview");
const messageBox = document.querySelector("#site-editor-message");
const userBox = document.querySelector("#site-editor-user");
const logoutButton = document.querySelector("#bcb-admin-logout");
const searchInput = document.querySelector("#site-editor-search");
const pageNameBox = document.querySelector("#site-editor-page-name");
const fieldCountBox = document.querySelector("#site-editor-field-count");
const changedCountBox = document.querySelector("#site-editor-changed-count");

let currentUser = null;
let currentPage = "home";
let overrides = new Map();

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(text, type = "success") {
  if (!messageBox) return;
  messageBox.hidden = false;
  messageBox.className = `site-editor-message is-${type}`;
  messageBox.textContent = text;
  window.setTimeout(() => { messageBox.hidden = true; }, 4500);
}

function displayImageUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `../${value.replace(/^\.\//, "")}`;
}

function currentPageDefinition() {
  return SITE_EDITOR_PAGES.find((item) => item.key === currentPage);
}

function pageFields() {
  return SITE_EDITOR_FIELDS.filter((field) => field.page === currentPage);
}

function updateStats() {
  const fields = pageFields();
  const page = currentPageDefinition();
  const changed = fields.filter((field) => overrides.has(field.key)).length;
  if (pageNameBox) pageNameBox.textContent = page?.label || currentPage;
  if (fieldCountBox) fieldCountBox.textContent = fields.length;
  if (changedCountBox) changedCountBox.textContent = changed;
}

function renderTabs() {
  tabs.innerHTML = SITE_EDITOR_PAGES.map((page) => `
    <button type="button" class="site-editor-tab ${page.key === currentPage ? "is-active" : ""}" data-page="${page.key}">${escapeHtml(page.label)}</button>
  `).join("");

  const page = currentPageDefinition();
  if (page && previewLink) previewLink.href = page.url;
  updateStats();
}

function renderEditor() {
  const query = (searchInput?.value || "").trim().toLowerCase();
  const allFields = pageFields();
  const fields = !query ? allFields : allFields.filter((field) => {
    const haystack = `${field.group} ${field.label} ${field.defaultValue || ""}`.toLowerCase();
    return haystack.includes(query);
  });

  updateStats();

  if (!fields.length) {
    content.innerHTML = query
      ? '<div class="bcb-admin-empty">Nu am găsit niciun câmp pentru căutarea ta.</div>'
      : '<div class="bcb-admin-empty">Nu există încă elemente editabile pentru această pagină.</div>';
    return;
  }

  const groups = [...new Set(fields.map((field) => field.group))];
  content.innerHTML = groups.map((group) => {
    const groupFields = fields.filter((field) => field.group === group);
    const changedInGroup = groupFields.filter((field) => overrides.has(field.key)).length;
    return `
      <section class="site-editor-group">
        <div class="site-editor-group-heading">
          <div><span>Conținut editabil</span><h3>${escapeHtml(group)}</h3></div>
          <small>${changedInGroup ? `${changedInGroup} personalizat${changedInGroup === 1 ? "" : "e"}` : `${groupFields.length} câmp${groupFields.length === 1 ? "" : "uri"}`}</small>
        </div>
        <div class="site-editor-fields">
          ${groupFields.map(renderField).join("")}
        </div>
      </section>`;
  }).join("");
}

function renderField(field) {
  const saved = overrides.get(field.key);
  const value = saved?.value ?? field.defaultValue ?? "";
  const changed = overrides.has(field.key);
  const wide = field.type === "image" || field.type === "background" || String(field.defaultValue || "").length > 85;

  if (field.type === "image" || field.type === "background") {
    return `
      <article class="site-editor-field ${wide ? "is-wide" : ""}" data-field-key="${escapeHtml(field.key)}">
        <div class="site-editor-field-head"><label>${escapeHtml(field.label)}</label>${changed ? '<span class="site-editor-changed">Personalizat</span>' : ""}</div>
        <div class="site-editor-image-preview"><img src="${escapeHtml(displayImageUrl(value))}" alt="Preview"></div>
        <div class="site-editor-image-meta">${escapeHtml(value)}</div>
        <div class="site-editor-actions">
          <label class="site-editor-upload"><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" data-action="upload"><i class="fa-solid fa-cloud-arrow-up"></i> Schimbă imaginea</label>
          ${changed ? '<button type="button" class="site-editor-reset" data-action="reset"><i class="fa-solid fa-rotate-left"></i> Original</button>' : ""}
        </div>
      </article>`;
  }

  const input = String(value).length > 85
    ? `<textarea data-value>${escapeHtml(value)}</textarea>`
    : `<input type="text" data-value value="${escapeHtml(value)}">`;

  return `
    <article class="site-editor-field ${wide ? "is-wide" : ""}" data-field-key="${escapeHtml(field.key)}">
      <div class="site-editor-field-head"><label>${escapeHtml(field.label)}</label>${changed ? '<span class="site-editor-changed">Personalizat</span>' : ""}</div>
      ${input}
      <div class="site-editor-actions">
        ${changed ? '<button type="button" class="site-editor-reset" data-action="reset"><i class="fa-solid fa-rotate-left"></i> Original</button>' : ""}
        <button type="button" class="site-editor-save" data-action="save"><i class="fa-solid fa-floppy-disk"></i> Publică</button>
      </div>
    </article>`;
}

async function requireAdmin() {
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

  if (error || !profile?.is_active || profile.role !== "admin") {
    window.location.replace("dashboard.html");
    return false;
  }

  currentUser = session.user;
  if (userBox) userBox.textContent = profile.full_name || "Administrator BCB";
  return true;
}

async function loadOverrides() {
  const { data, error } = await supabase
    .from("site_content")
    .select("content_key, page_key, content_type, value, updated_at");

  if (error) {
    content.innerHTML = '<div class="bcb-admin-empty">Site Editor nu este încă activat în baza de date. Rulează migrarea Site Editor din Supabase.</div>';
    return false;
  }

  overrides = new Map((data || []).map((item) => [item.content_key, item]));
  updateStats();
  return true;
}

async function saveText(field, card) {
  const input = card.querySelector("[data-value]");
  const value = input?.value.trim();
  if (!value) {
    showMessage("Câmpul nu poate fi gol. Folosește «Original» dacă vrei să revii la textul inițial.", "error");
    return;
  }

  card.classList.add("site-editor-saving");
  const { error } = await supabase.from("site_content").upsert({
    content_key: field.key,
    page_key: field.page,
    content_type: "text",
    value,
    updated_by: currentUser.id
  }, { onConflict: "content_key" });
  card.classList.remove("site-editor-saving");

  if (error) {
    console.error(error);
    showMessage("Modificarea nu a putut fi publicată.", "error");
    return;
  }

  overrides.set(field.key, { content_key: field.key, value });
  renderEditor();
  showMessage("Modificarea a fost publicată pe site.");
}

async function uploadImage(field, file, card) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showMessage("Selectează o imagine validă.", "error");
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showMessage("Imaginea este prea mare. Limita este 20 MB.", "error");
    return;
  }

  card.classList.add("site-editor-saving");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeKey = field.key.replace(/[^a-z0-9.-]/gi, "-");
  const storagePath = `${field.page}/${safeKey}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("site-content").upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type
  });

  if (uploadError) {
    card.classList.remove("site-editor-saving");
    console.error(uploadError);
    showMessage("Imaginea nu a putut fi încărcată.", "error");
    return;
  }

  const publicUrl = supabase.storage.from("site-content").getPublicUrl(storagePath).data.publicUrl;
  const { error: rowError } = await supabase.from("site_content").upsert({
    content_key: field.key,
    page_key: field.page,
    content_type: "image",
    value: publicUrl,
    updated_by: currentUser.id
  }, { onConflict: "content_key" });

  card.classList.remove("site-editor-saving");

  if (rowError) {
    await supabase.storage.from("site-content").remove([storagePath]);
    console.error(rowError);
    showMessage("Imaginea a fost încărcată, dar nu a putut fi publicată.", "error");
    return;
  }

  overrides.set(field.key, { content_key: field.key, value: publicUrl });
  renderEditor();
  showMessage("Imaginea a fost publicată pe site.");
}

async function resetField(field, card) {
  if (!window.confirm(`Revii la varianta originală pentru „${field.label}”?`)) return;
  card.classList.add("site-editor-saving");
  const { error } = await supabase.from("site_content").delete().eq("content_key", field.key);
  card.classList.remove("site-editor-saving");

  if (error) {
    showMessage("Nu am putut reveni la varianta originală.", "error");
    return;
  }

  overrides.delete(field.key);
  renderEditor();
  showMessage("Elementul a revenit la varianta originală.");
}

tabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (!button) return;
  currentPage = button.dataset.page;
  if (searchInput) searchInput.value = "";
  renderTabs();
  renderEditor();
});

searchInput?.addEventListener("input", renderEditor);

content?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest("[data-field-key]");
  const field = SITE_EDITOR_FIELDS.find((item) => item.key === card?.dataset.fieldKey);
  if (!field) return;

  if (button.dataset.action === "save") await saveText(field, card);
  if (button.dataset.action === "reset") await resetField(field, card);
});

content?.addEventListener("change", async (event) => {
  const input = event.target.closest("input[data-action='upload']");
  if (!input) return;
  const card = input.closest("[data-field-key]");
  const field = SITE_EDITOR_FIELDS.find((item) => item.key === card?.dataset.fieldKey);
  if (!field) return;
  await uploadImage(field, input.files?.[0], card);
});

logoutButton?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.replace("index.html");
});

(async function init() {
  if (!(await requireAdmin())) return;
  renderTabs();
  if (await loadOverrides()) renderEditor();
})();
