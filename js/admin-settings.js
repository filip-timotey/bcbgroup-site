import { supabase } from "./supabase-client.js";
import { SITE_SETTINGS_GROUPS, SITE_SETTINGS } from "./site-settings-registry.js";

const tabs = document.querySelector("#settings-tabs");
const content = document.querySelector("#settings-content");
const messageBox = document.querySelector("#settings-message");
const totalBox = document.querySelector("#settings-total");
const customBox = document.querySelector("#settings-custom");
const lastUpdateBox = document.querySelector("#settings-last-update");
const saveGroupBtn = document.querySelector("#settings-save-group");
const resetGroupBtn = document.querySelector("#settings-reset-group");
const userBox = document.querySelector("#settings-user");
const logoutButton = document.querySelector("#bcb-admin-logout");

let currentGroup = SITE_SETTINGS_GROUPS[0].key;
let currentUser = null;
let saved = new Map();
let working = new Map();

function esc(value = "") {
  return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function showMessage(text, type = "success") {
  messageBox.hidden = false;
  messageBox.className = `settings-message is-${type}`;
  messageBox.textContent = text;
  window.setTimeout(() => { messageBox.hidden = true; }, 5000);
}

function valueFor(field) {
  if (working.has(field.key)) return working.get(field.key);
  if (saved.has(field.key)) return saved.get(field.key).setting_value ?? "";
  return field.defaultValue ?? "";
}

function renderTabs() {
  tabs.innerHTML = SITE_SETTINGS_GROUPS.map(group => `
    <button type="button" class="settings-tab ${group.key === currentGroup ? "is-active" : ""}" data-group="${group.key}">
      <i class="fa-solid ${group.icon}"></i>${esc(group.label)}
    </button>`).join("");
}

function fieldInput(field, value) {
  const attrs = `data-setting-input="${esc(field.key)}"`;
  if (field.type === "textarea") return `<textarea ${attrs}>${esc(value)}</textarea>`;
  const inputType = ["email","url","tel"].includes(field.type) ? field.type : "text";
  return `<input ${attrs} type="${inputType}" value="${esc(value)}" ${field.optional ? "" : "required"}>`;
}

function renderGroup() {
  const group = SITE_SETTINGS_GROUPS.find(item => item.key === currentGroup);
  const fields = SITE_SETTINGS.filter(item => item.group === currentGroup);
  const dirtyCount = fields.filter(field => working.has(field.key)).length;
  const descriptions = {
    identity:"Datele oficiale și identitatea publică a companiei.",
    contact:"Canalele principale prin care clienții pot contacta BCB Group.",
    operations:"Programul, aria principală de activitate și sediul companiei.",
    social:"Linkurile oficiale către conturile BCB Group. Se actualizează automat în toate butoanele sociale.",
    footer:"Textele globale din footer și informațiile juridice afișate public."
  };

  content.innerHTML = `
    <section class="settings-panel">
      <div class="settings-panel-head">
        <div><h2>${esc(group.label)}</h2><p>${esc(descriptions[currentGroup] || "Setări globale BCB Group.")}</p></div>
        ${dirtyCount ? `<span class="settings-dirty">${dirtyCount} modificări nesalvate</span>` : ""}
      </div>
      <div class="settings-grid">
        ${fields.map(field => {
          const value = valueFor(field);
          const customized = saved.has(field.key);
          const wide = field.type === "textarea" || field.type === "url";
          return `<article class="settings-field ${wide ? "is-wide" : ""}" data-setting-card="${esc(field.key)}">
            <div class="settings-field-head"><label>${esc(field.label)}</label>${customized ? '<span class="settings-field-badge">Personalizat</span>' : '<span class="settings-field-badge">Implicit</span>'}</div>
            ${fieldInput(field, value)}
            ${field.help ? `<p class="settings-field-help">${esc(field.help)}</p>` : ""}
          </article>`;
        }).join("")}
      </div>
    </section>`;
}

function updateStats() {
  totalBox.textContent = String(SITE_SETTINGS.length);
  customBox.textContent = String(saved.size);
  const dates = [...saved.values()].map(row => row.updated_at).filter(Boolean).sort().reverse();
  lastUpdateBox.textContent = dates[0] ? new Intl.DateTimeFormat("ro-RO", { dateStyle:"medium", timeStyle:"short" }).format(new Date(dates[0])) : "—";
}

function validate(field, value) {
  const trimmed = value.trim();
  if (!field.optional && !trimmed) return false;
  if (field.type === "email" && trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
  if (field.type === "url" && trimmed) {
    try { const url = new URL(trimmed); if (!/^https?:$/.test(url.protocol)) return false; } catch { return false; }
  }
  if (field.type === "tel" && trimmed && !/^\d{8,16}$/.test(trimmed.replace(/\s+/g,""))) return false;
  return true;
}

async function requireAdmin() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) { window.location.replace("index.html"); return false; }
  const { data: profile, error } = await supabase.from("profiles").select("id, full_name, role, is_active").eq("id", session.user.id).single();
  if (error || !profile?.is_active || profile.role !== "admin") { window.location.replace("dashboard.html"); return false; }
  currentUser = session.user;
  userBox.textContent = profile.full_name || "Administrator BCB";
  return true;
}

async function loadSettings() {
  const { data, error } = await supabase.from("site_settings").select("setting_key, setting_value, updated_at, updated_by");
  if (error) {
    content.innerHTML = '<div class="bcb-admin-empty">Modulul Setări site nu este încă activat în Supabase. Rulează migrarea 20260815_site_settings.sql.</div>';
    return false;
  }
  saved = new Map((data || []).map(row => [row.setting_key, row]));
  working.clear();
  updateStats();
  return true;
}

async function saveCurrentGroup() {
  const fields = SITE_SETTINGS.filter(item => item.group === currentGroup);
  const rows = [];
  let invalid = false;

  fields.forEach(field => {
    const input = content.querySelector(`[data-setting-input="${CSS.escape(field.key)}"]`);
    if (!input) return;
    const value = input.value.trim();
    const card = input.closest(".settings-field");
    const valid = validate(field, value);
    card?.classList.toggle("is-invalid", !valid);
    if (!valid) { invalid = true; return; }
    rows.push({ setting_key:field.key, setting_value:value, updated_by:currentUser.id });
  });

  if (invalid) { showMessage("Verifică câmpurile marcate. Unele valori nu sunt valide.", "error"); return; }

  saveGroupBtn.disabled = true;
  resetGroupBtn.disabled = true;
  const { data, error } = await supabase.from("site_settings").upsert(rows, { onConflict:"setting_key" }).select("setting_key, setting_value, updated_at, updated_by");
  saveGroupBtn.disabled = false;
  resetGroupBtn.disabled = false;

  if (error) { console.error(error); showMessage("Setările nu au putut fi salvate.", "error"); return; }
  (data || []).forEach(row => saved.set(row.setting_key, row));
  working.clear();
  updateStats();
  renderGroup();
  showMessage("Categoria a fost salvată și este sincronizată cu site-ul.");
}

async function resetCurrentGroup() {
  const group = SITE_SETTINGS_GROUPS.find(item => item.key === currentGroup);
  if (!window.confirm(`Revii la valorile implicite pentru categoria „${group.label}”?`)) return;
  const keys = SITE_SETTINGS.filter(item => item.group === currentGroup).map(item => item.key);
  saveGroupBtn.disabled = true;
  resetGroupBtn.disabled = true;
  const { error } = await supabase.from("site_settings").delete().in("setting_key", keys);
  saveGroupBtn.disabled = false;
  resetGroupBtn.disabled = false;
  if (error) { showMessage("Categoria nu a putut fi resetată.", "error"); return; }
  keys.forEach(key => { saved.delete(key); working.delete(key); });
  updateStats();
  renderGroup();
  showMessage("Categoria a revenit la valorile implicite.");
}

tabs?.addEventListener("click", event => {
  const btn = event.target.closest("[data-group]");
  if (!btn) return;
  currentGroup = btn.dataset.group;
  working.clear();
  renderTabs();
  renderGroup();
});

content?.addEventListener("input", event => {
  const input = event.target.closest("[data-setting-input]");
  if (!input) return;
  working.set(input.dataset.settingInput, input.value);
  renderGroup();
  const ref = content.querySelector(`[data-setting-input="${CSS.escape(input.dataset.settingInput)}"]`);
  if (ref) { ref.focus(); try { ref.setSelectionRange(ref.value.length, ref.value.length); } catch {} }
});

saveGroupBtn?.addEventListener("click", saveCurrentGroup);
resetGroupBtn?.addEventListener("click", resetCurrentGroup);
logoutButton?.addEventListener("click", async () => { await supabase.auth.signOut(); window.location.replace("index.html"); });

(async function init() {
  if (!(await requireAdmin())) return;
  renderTabs();
  if (await loadSettings()) renderGroup();
})();
