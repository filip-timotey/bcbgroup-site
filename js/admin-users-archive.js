import { supabase } from "./supabase-client.js";
import { requireStaffContext, isOwnerProfile } from "./admin-session.js";

const usersList = document.querySelector("#bcb-users-list");
const usersPanel = document.querySelector(".bcb-users-panel");
const messageBox = document.querySelector("#bcb-users-message");
let currentProfile = null;
let archivedProfiles = [];
let observer = null;
let refreshing = false;

const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const initials = (name = "BCB") => (String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "BCB").slice(0, 3);

function showMessage(text, type = "success") {
  if (!messageBox) return;
  messageBox.hidden = false;
  messageBox.className = `bcb-users-message is-${type}`;
  messageBox.textContent = text;
}

async function invokeManagement(body) {
  const { data, error } = await supabase.functions.invoke("manage-bcb-user", { body });
  if (error || !data?.success) {
    let text = data?.error || "Operațiunea nu a putut fi executată.";
    if (error?.context) {
      try {
        const details = await error.context.json();
        if (details?.error) text = details.error;
      } catch (_) {}
    }
    throw new Error(text);
  }
  return data;
}

function ensureArchivePanel() {
  let panel = document.querySelector("#bcb-archived-users");
  if (panel) return panel;
  panel = document.createElement("section");
  panel.id = "bcb-archived-users";
  panel.className = "bcb-users-panel bcb-archived-users";
  usersPanel?.after(panel);
  return panel;
}

function renderArchivePanel() {
  const panel = ensureArchivePanel();
  if (!panel) return;
  if (!isOwnerProfile(currentProfile)) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  panel.innerHTML = `<div class="bcb-users-panel-heading"><div><span class="bcb-admin-section-kicker">Istoric acces</span><h2>Conturi arhivate</h2></div><div class="bcb-users-sync"><span></span>${archivedProfiles.length} arhivate</div></div>
    <p class="bcb-archive-note">Conturile arhivate nu mai au acces la Business Manager. Datele și istoricul operațional sunt păstrate, iar Owner-ul poate restaura accesul în siguranță.</p>
    <div class="bcb-users-list">${archivedProfiles.length ? archivedProfiles.map(profile => {
      const identifier = profile.full_name || profile.email || "Utilizator BCB";
      const archivedAt = profile.archived_at ? new Intl.DateTimeFormat("ro-RO", { dateStyle:"medium", timeStyle:"short" }).format(new Date(profile.archived_at)) : "dată necunoscută";
      return `<article class="bcb-user-row is-archived" data-archived-user-id="${esc(profile.id)}">
        <div class="bcb-user-main"><div class="bcb-user-avatar">${esc(initials(identifier))}</div><div><h3>${esc(identifier)}</h3><p>${esc(profile.email || `ID · ${profile.id.slice(0, 8)}…`)}</p><div class="bcb-user-badges"><span class="bcb-user-badge"><i class="fa-solid fa-box-archive"></i> ARHIVAT</span></div></div></div>
        <div><span class="bcb-archive-role">${profile.role === "admin" ? "Administrator" : "Editor"}</span></div>
        <div class="bcb-user-status"><span>Arhivat · ${esc(archivedAt)}</span></div>
        <div class="bcb-user-actions"><button type="button" class="bcb-user-save" data-restore-user="${esc(profile.id)}"><i class="fa-solid fa-user-check"></i> Restaurează accesul</button></div>
      </article>`;
    }).join("") : '<div class="bcb-admin-empty">Nu există conturi arhivate.</div>'}</div>`;
}

function alignActiveUsersUi() {
  if (!usersList) return;
  const archivedIds = new Set(archivedProfiles.map(profile => profile.id));
  usersList.querySelectorAll("[data-user-id]").forEach(row => {
    if (archivedIds.has(row.dataset.userId)) {
      row.remove();
      return;
    }
    const danger = row.querySelector('button[data-action="delete"]');
    if (!danger) return;
    const ownerAction = danger.classList.contains("bcb-user-danger");
    danger.innerHTML = ownerAction
      ? '<i class="fa-solid fa-user-lock"></i> Elimină accesul'
      : '<i class="fa-solid fa-user-lock"></i> Solicită eliminarea';
  });

  document.querySelectorAll("#bcb-owner-approvals .bcb-owner-request strong").forEach(label => {
    if (label.textContent?.startsWith("Ștergere cont")) label.textContent = label.textContent.replace("Ștergere cont", "Eliminare acces");
  });
}

async function loadArchived() {
  if (refreshing) return;
  refreshing = true;
  try {
    const { data, error } = await supabase.from("profiles")
      .select("id,full_name,email,role,is_active,is_owner,is_archived,archived_at,archived_by,created_at")
      .eq("is_archived", true)
      .order("archived_at", { ascending:false });
    if (error) throw error;
    archivedProfiles = data || [];
    renderArchivePanel();
    alignActiveUsersUi();
  } catch (error) {
    console.error("BCB archived users load error:", error);
  } finally {
    refreshing = false;
  }
}

usersList?.addEventListener("click", event => {
  const button = event.target.closest('button[data-action="delete"]');
  if (!button) return;
  // admin-users.js owns execution; this module only corrects the visible semantics.
  queueMicrotask(alignActiveUsersUi);
}, true);

document.addEventListener("click", async event => {
  const button = event.target.closest("button[data-restore-user]");
  if (!button || !isOwnerProfile(currentProfile)) return;
  const profile = archivedProfiles.find(item => item.id === button.dataset.restoreUser);
  if (!profile) return;
  if (!confirm(`Restaurezi accesul pentru ${profile.full_name || profile.email}? Contul va putea din nou să se autentifice în Business Manager.`)) return;
  button.disabled = true;
  const original = button.innerHTML;
  button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Se restaurează…';
  try {
    await invokeManagement({ action:"owner_execute", operation:"reactivate", target_user_id:profile.id });
    showMessage("Accesul utilizatorului a fost restaurat în siguranță.");
    await loadArchived();
    window.setTimeout(() => window.location.reload(), 350);
  } catch (error) {
    showMessage(error.message || "Accesul nu a putut fi restaurat.", "error");
    button.disabled = false;
    button.innerHTML = original;
  }
});

(async function initArchiveUx() {
  const ctx = await requireStaffContext({ adminOnly:true });
  if (!ctx) return;
  currentProfile = ctx.profile;
  await loadArchived();
  observer = new MutationObserver(() => {
    alignActiveUsersUi();
    if (isOwnerProfile(currentProfile)) renderArchivePanel();
  });
  if (usersList) observer.observe(usersList, { childList:true, subtree:true });
  const approvals = document.querySelector("#bcb-owner-approvals");
  if (approvals) observer.observe(approvals, { childList:true, subtree:true });
})();
