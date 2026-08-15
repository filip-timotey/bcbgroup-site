import { supabase } from "./supabase-client.js";
import { SITE_EDITOR_FIELDS, SITE_EDITOR_PAGES } from "./site-editor-registry.js";
import { requireStaffContext, bindAdminLogout } from "./admin-session.js";

const HERO_MEDIA_KEY = "home.hero.background";
const IMAGE_TYPES = ["image/jpeg","image/png","image/webp","image/avif"];
const VIDEO_TYPES = ["video/mp4","video/webm"];
const MAX_IMAGE = 20 * 1024 * 1024;
const MAX_VIDEO = 150 * 1024 * 1024;

const tabs = document.querySelector("#site-editor-tabs");
const content = document.querySelector("#site-editor-content");
const previewLink = document.querySelector("#site-editor-preview");
const messageBox = document.querySelector("#site-editor-message");
const userBox = document.querySelector("#site-editor-user");
const searchInput = document.querySelector("#site-editor-search");
const pageNameBox = document.querySelector("#site-editor-page-name");
const fieldCountBox = document.querySelector("#site-editor-field-count");
const changedCountBox = document.querySelector("#site-editor-changed-count");

let currentUser = null;
let currentPage = "home";
let overrides = new Map();
let uploadBusy = false;

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
  window.clearTimeout(showMessage.timer);
  showMessage.timer = window.setTimeout(() => { messageBox.hidden = true; }, 5000);
}

function displayMediaUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `../${value.replace(/^\.\//, "")}`;
}

function isVideoValue(value = "", contentType = "") {
  return contentType === "video" || /\.(mp4|webm)(?:$|\?)/i.test(String(value));
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
  if (!tabs) return;
  tabs.innerHTML = SITE_EDITOR_PAGES.map((page) => `
    <button type="button" class="site-editor-tab ${page.key === currentPage ? "is-active" : ""}" data-page="${page.key}">${escapeHtml(page.label)}</button>
  `).join("");
  const page = currentPageDefinition();
  if (page && previewLink) previewLink.href = page.url;
  updateStats();
}

function renderEditor() {
  if (!content) return;
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
        <div class="site-editor-fields">${groupFields.map(renderField).join("")}</div>
      </section>`;
  }).join("");
}

function renderField(field) {
  const saved = overrides.get(field.key);
  const value = saved?.value ?? field.defaultValue ?? "";
  const contentType = saved?.content_type || (field.type === "image" || field.type === "background" ? "image" : "text");
  const changed = overrides.has(field.key);
  const wide = field.type === "image" || field.type === "background" || String(field.defaultValue || "").length > 85;

  if (field.type === "image" || field.type === "background") {
    const heroMedia = field.key === HERO_MEDIA_KEY;
    const video = heroMedia && isVideoValue(value, contentType);
    const preview = video
      ? `<video src="${escapeHtml(displayMediaUrl(value))}" controls muted loop playsinline preload="metadata"></video>`
      : `<img src="${escapeHtml(displayMediaUrl(value))}" alt="Preview">`;
    const accept = heroMedia
      ? "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
      : "image/jpeg,image/png,image/webp,image/avif";
    return `
      <article class="site-editor-field ${wide ? "is-wide" : ""}" data-field-key="${escapeHtml(field.key)}">
        <div class="site-editor-field-head"><label>${escapeHtml(field.label)}</label>${changed ? '<span class="site-editor-changed">Personalizat</span>' : ""}</div>
        <div class="site-editor-image-preview">${preview}</div>
        <div class="site-editor-image-meta">${escapeHtml(value)}</div>
        ${heroMedia ? '<div class="site-editor-media-note"><i class="fa-solid fa-circle-info"></i> Fundalul Hero acceptă imagine sau video MP4/WebM. Video-ul este redat automat fără sunet, în buclă.</div>' : ""}
        <div class="site-editor-actions">
          <label class="site-editor-upload"><input type="file" accept="${accept}" data-action="upload"><i class="fa-solid fa-cloud-arrow-up"></i> ${heroMedia ? "Schimbă imaginea / video" : "Schimbă imaginea"}</label>
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

async function loadOverrides() {
  const { data, error } = await supabase.from("site_content").select("content_key,page_key,content_type,value,updated_at");
  if (error) {
    console.error(error);
    content.innerHTML = '<div class="bcb-admin-empty">Site Editor nu a putut încărca datele din Supabase.</div>';
    return false;
  }
  overrides = new Map((data || []).map((item) => [item.content_key, item]));
  updateStats();
  return true;
}

async function saveText(field, card) {
  const input = card.querySelector("[data-value]");
  const value = input?.value.trim();
  if (!value) { showMessage("Câmpul nu poate fi gol. Folosește «Original» pentru varianta inițială.", "error"); return; }
  card.classList.add("site-editor-saving");
  const { error } = await supabase.from("site_content").upsert({content_key:field.key,page_key:field.page,content_type:"text",value,updated_by:currentUser.id},{onConflict:"content_key"});
  card.classList.remove("site-editor-saving");
  if (error) { console.error(error); showMessage("Modificarea nu a putut fi publicată.", "error"); return; }
  overrides.set(field.key,{content_key:field.key,page_key:field.page,content_type:"text",value});
  renderEditor(); showMessage("Modificarea a fost publicată pe site.");
}

async function uploadMedia(field, file, card) {
  if (!file || uploadBusy) return;
  const isVideo = VIDEO_TYPES.includes(file.type);
  const isImage = IMAGE_TYPES.includes(file.type);
  const heroMedia = field.key === HERO_MEDIA_KEY;

  if (!isImage && !isVideo) { showMessage("Fișier neacceptat. Folosește JPG, PNG, WebP, AVIF, MP4 sau WebM.", "error"); return; }
  if (isVideo && !heroMedia) { showMessage("Video poate fi folosit doar pentru Fundal Hero pe pagina Acasă.", "error"); return; }
  if (isImage && file.size > MAX_IMAGE) { showMessage("Imaginea este prea mare. Limita este 20 MB.", "error"); return; }
  if (isVideo && file.size > MAX_VIDEO) { showMessage("Video-ul este prea mare. Limita este 150 MB.", "error"); return; }

  uploadBusy = true;
  card.classList.add("site-editor-saving");
  const input = card.querySelector("input[data-action='upload']");
  if (input) input.disabled = true;

  try {
    const ext = isVideo ? (file.type === "video/webm" ? "webm" : "mp4") : (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const safeKey = field.key.replace(/[^a-z0-9.-]/gi, "-");
    const storagePath = `${field.page}/${safeKey}-${Date.now()}.${ext}`;
    showMessage(isVideo ? "Se încarcă video-ul Hero…" : "Se încarcă imaginea…", "loading");

    const { error: uploadError } = await supabase.storage.from("site-content").upload(storagePath,file,{cacheControl:"3600",upsert:false,contentType:file.type});
    if (uploadError) throw uploadError;

    const publicUrl = supabase.storage.from("site-content").getPublicUrl(storagePath).data.publicUrl;
    const contentType = isVideo ? "video" : "image";
    const { error: rowError } = await supabase.from("site_content").upsert({content_key:field.key,page_key:field.page,content_type:contentType,value:publicUrl,updated_by:currentUser.id},{onConflict:"content_key"});
    if (rowError) {
      await supabase.storage.from("site-content").remove([storagePath]);
      throw rowError;
    }

    overrides.set(field.key,{content_key:field.key,page_key:field.page,content_type:contentType,value:publicUrl});
    renderEditor();
    showMessage(isVideo ? "Video-ul a fost publicat ca fundal Hero pe pagina Acasă." : "Imaginea a fost publicată pe site.");
  } catch (error) {
    console.error(error);
    const detail = error?.message ? ` ${error.message}` : "";
    showMessage(`Fișierul nu a putut fi publicat.${detail}`, "error");
  } finally {
    uploadBusy = false;
    card.classList.remove("site-editor-saving");
    if (input) input.disabled = false;
  }
}

async function resetField(field, card) {
  if (!window.confirm(`Revii la varianta originală pentru „${field.label}”?`)) return;
  card.classList.add("site-editor-saving");
  const { error } = await supabase.from("site_content").delete().eq("content_key",field.key);
  card.classList.remove("site-editor-saving");
  if (error) { showMessage("Nu am putut reveni la varianta originală.", "error"); return; }
  overrides.delete(field.key); renderEditor(); showMessage("Elementul a revenit la varianta originală.");
}

tabs?.addEventListener("click", event => {
  const button=event.target.closest("[data-page]"); if(!button)return;
  currentPage=button.dataset.page; if(searchInput)searchInput.value=""; renderTabs(); renderEditor();
});
searchInput?.addEventListener("input",renderEditor);
content?.addEventListener("click",async event=>{
  const button=event.target.closest("button[data-action]"); if(!button)return;
  const card=button.closest("[data-field-key]"); const field=SITE_EDITOR_FIELDS.find(item=>item.key===card?.dataset.fieldKey); if(!field)return;
  if(button.dataset.action==="save") await saveText(field,card);
  if(button.dataset.action==="reset") await resetField(field,card);
});
content?.addEventListener("change",async event=>{
  const input=event.target.closest("input[data-action='upload']"); if(!input)return;
  const card=input.closest("[data-field-key]"); const field=SITE_EDITOR_FIELDS.find(item=>item.key===card?.dataset.fieldKey); if(!field)return;
  await uploadMedia(field,input.files?.[0],card);
});

(async function init(){
  bindAdminLogout();
  const context = await requireStaffContext({adminOnly:true});
  if(!context)return;
  currentUser=context.session.user;
  if(userBox)userBox.textContent=context.profile.full_name||"Administrator BCB";
  renderTabs();
  if(await loadOverrides())renderEditor();
})();
