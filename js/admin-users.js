import { supabase } from "./supabase-client.js";
import { requireStaffContext, bindAdminLogout, isOwnerProfile } from "./admin-session.js";

const userName = document.querySelector("#bcb-admin-user-name");
const usersList = document.querySelector("#bcb-users-list");
const messageBox = document.querySelector("#bcb-users-message");
const totalBox = document.querySelector("#users-total");
const activeBox = document.querySelector("#users-active");
const adminsBox = document.querySelector("#users-admins");
const editorsBox = document.querySelector("#users-editors");
const inviteForm = document.querySelector("#bcb-users-invite-form");
const inviteName = document.querySelector("#invite-full-name");
const inviteEmail = document.querySelector("#invite-email");
const inviteRole = document.querySelector("#invite-role");
const inviteButton = document.querySelector("#bcb-users-invite-button");
const inviteMessage = document.querySelector("#bcb-users-invite-message");

let currentProfile = null;
let profiles = [];
let accessRequests = [];
let inviteBusy = false;
let loadToken = 0;

const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const initials = (name = "BCB") => (String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "BCB").slice(0, 3);
const profileById = id => profiles.find(p => p.id === id);
const isOwner = p => Boolean(p?.is_owner);
const isCurrentOwner = () => isOwner(currentProfile);

function showMessage(box, text, type = "success") {
  if (!box) return;
  box.hidden = false;
  box.className = `${box === inviteMessage ? "bcb-users-invite-message" : "bcb-users-message"} is-${type}`;
  box.textContent = text;
}

function updateStats() {
  totalBox && (totalBox.textContent = profiles.length);
  activeBox && (activeBox.textContent = profiles.filter(p => p.is_active).length);
  adminsBox && (adminsBox.textContent = profiles.filter(p => (p.role === "admin" || p.is_owner) && p.is_active).length);
  editorsBox && (editorsBox.textContent = profiles.filter(p => p.role === "editor" && p.is_active).length);
}

function pendingRequest(targetId, action) {
  return accessRequests.find(r => r.target_user_id === targetId && r.action === action && r.status === "pending");
}

function actionButtons(profile) {
  if (profile.is_owner) return '<div class="bcb-owner-lock"><i class="fa-solid fa-lock"></i> Protejat</div>';
  const deletePending = pendingRequest(profile.id, "delete");
  if (isCurrentOwner()) {
    return `<div class="bcb-user-actions"><button type="button" class="bcb-user-save" data-action="save"><i class="fa-solid fa-floppy-disk"></i> Salvează</button><button type="button" class="bcb-user-danger" data-action="delete"><i class="fa-solid fa-trash"></i> Șterge</button></div>`;
  }
  return `<div class="bcb-user-actions"><button type="button" class="bcb-user-save" data-action="save"><i class="fa-solid fa-floppy-disk"></i> Salvează</button><button type="button" class="bcb-user-request" data-action="delete" ${deletePending ? "disabled" : ""}><i class="fa-solid fa-user-lock"></i> ${deletePending ? "Așteaptă Owner" : "Solicită ștergere"}</button></div>`;
}

function renderUsers() {
  if (!usersList) return;
  if (!profiles.length) {
    usersList.innerHTML = '<div class="bcb-admin-empty">Nu există utilizatori disponibili.</div>';
    return;
  }

  usersList.innerHTML = profiles.map(profile => {
    const identifier = profile.full_name || profile.email || "Utilizator BCB";
    const owner = isOwner(profile);
    const pendingDeactivate = pendingRequest(profile.id, "deactivate");
    const toggleDisabled = owner || (!isCurrentOwner() && profile.is_active && pendingDeactivate);
    const roleLabel = owner ? "Owner" : profile.role === "admin" ? "Administrator" : "Editor";

    return `<article class="bcb-user-row ${owner ? "is-owner" : ""}" data-user-id="${esc(profile.id)}">
      <div class="bcb-user-main">
        <div class="bcb-user-avatar">${owner ? '<i class="fa-solid fa-crown"></i>' : esc(initials(identifier))}</div>
        <div>
          <h3>${esc(identifier)}</h3>
          <p>${esc(profile.email || `ID · ${profile.id.slice(0, 8)}…`)}</p>
          <div class="bcb-user-badges">
            ${owner ? '<span class="bcb-user-badge is-owner"><i class="fa-solid fa-crown"></i> OWNER</span>' : `<span class="bcb-user-badge">${esc(roleLabel)}</span>`}
            ${profile.id === currentProfile?.id ? '<span class="bcb-user-badge"><i class="fa-solid fa-user-check"></i> Contul tău</span>' : ""}
          </div>
        </div>
      </div>
      <div>
        <select data-field="role" aria-label="Rol utilizator" ${owner ? "disabled" : ""}>
          <option value="editor" ${profile.role === "editor" ? "selected" : ""}>Editor</option>
          <option value="admin" ${profile.role === "admin" ? "selected" : ""}>Administrator</option>
        </select>
      </div>
      <div class="bcb-user-status">
        <button type="button" class="bcb-user-toggle ${profile.is_active ? "is-active" : ""}" data-action="toggle" aria-pressed="${profile.is_active}" ${toggleDisabled ? "disabled" : ""}></button>
        <span>${owner ? "Permanent activ" : pendingDeactivate ? "Așteaptă Owner" : profile.is_active ? "Activ" : "Inactiv"}</span>
      </div>
      ${actionButtons(profile)}
    </article>`;
  }).join("");
}

function ensureApprovalsPanel() {
  let panel = document.querySelector("#bcb-owner-approvals");
  if (panel) return panel;
  panel = document.createElement("section");
  panel.id = "bcb-owner-approvals";
  panel.className = "bcb-users-panel bcb-owner-approvals";
  const usersPanel = document.querySelector(".bcb-users-panel");
  usersPanel?.after(panel);
  return panel;
}

function renderApprovals() {
  const panel = ensureApprovalsPanel();
  if (!panel) return;
  const rows = isCurrentOwner() ? accessRequests.filter(r => r.status === "pending") : accessRequests.filter(r => r.requester_id === currentProfile?.id);
  panel.hidden = false;
  panel.innerHTML = `<div class="bcb-users-panel-heading"><div><span class="bcb-admin-section-kicker">Guvernanță acces</span><h2>${isCurrentOwner() ? "Aprobări Owner" : "Cererile mele către Owner"}</h2></div><div class="bcb-users-sync"><span></span>${rows.filter(r => r.status === "pending").length} în așteptare</div></div>
    <div class="bcb-owner-request-list">${rows.length ? rows.map(r => {
      const target = profileById(r.target_user_id);
      const requester = profileById(r.requester_id);
      const action = r.action === "delete" ? "Ștergere cont" : "Dezactivare acces";
      return `<article class="bcb-owner-request" data-request-id="${r.id}"><div><strong>${esc(action)} · ${esc(target?.full_name || target?.email || "Utilizator")}</strong><span>Solicitat de ${esc(requester?.full_name || requester?.email || "Administrator")} · ${new Intl.DateTimeFormat("ro-RO", { dateStyle:"medium", timeStyle:"short" }).format(new Date(r.created_at))}</span>${r.reason ? `<p>${esc(r.reason)}</p>` : ""}</div><span class="bcb-request-status is-${esc(r.status)}">${esc(r.status)}</span>${isCurrentOwner() && r.status === "pending" ? `<div class="bcb-request-actions"><button data-review="approved"><i class="fa-solid fa-check"></i> Aprobă</button><button data-review="rejected"><i class="fa-solid fa-xmark"></i> Respinge</button></div>` : ""}</article>`;
    }).join("") : '<div class="bcb-admin-empty">Nu există cereri de acces.</div>'}</div>`;
}

async function loadAccessRequests() {
  const { data, error } = await supabase.from("user_access_requests").select("*").order("created_at", { ascending:false }).limit(100);
  if (error) {
    console.error("BCB access requests load error:", error);
    accessRequests = [];
    return;
  }
  accessRequests = data || [];
}

async function loadUsers() {
  const token = ++loadToken;
  usersList && (usersList.innerHTML = '<div class="bcb-admin-empty">Se încarcă utilizatorii…</div>');
  const { data, error } = await supabase.from("profiles").select("id,full_name,email,role,is_active,is_owner,created_at,updated_at").order("created_at", { ascending:true });
  if (token !== loadToken) return;
  if (error) {
    console.error("BCB users load error:", error);
    usersList && (usersList.innerHTML = '<div class="bcb-admin-empty">Nu am putut încărca utilizatorii. Reîncearcă pagina.</div>');
    showMessage(messageBox, "Lista de utilizatori nu a putut fi sincronizată cu Supabase.", "error");
    return;
  }
  profiles = data || [];
  await loadAccessRequests();
  updateStats();
  renderUsers();
  renderApprovals();
}

async function invokeManagement(body) {
  const { data, error } = await supabase.functions.invoke("manage-bcb-user", { body });
  if (error || !data?.success) {
    let text = data?.error || "Operațiunea nu a putut fi executată.";
    if (error?.context) {
      try { const details = await error.context.json(); if (details?.error) text = details.error; } catch (_) {}
    }
    throw new Error(text);
  }
  return data;
}

usersList?.addEventListener("click", async event => {
  const row = event.target.closest("[data-user-id]");
  const button = event.target.closest("button[data-action]");
  if (!row || !button || button.disabled) return;
  const profile = profiles.find(x => x.id === row.dataset.userId);
  if (!profile || profile.is_owner) return;

  if (button.dataset.action === "toggle") {
    if (!isCurrentOwner() && profile.is_active) {
      const reason = prompt("Motivul dezactivării accesului (va fi trimis Owner-ului):") || "";
      try {
        await invokeManagement({ action:"request", operation:"deactivate", target_user_id:profile.id, reason });
        showMessage(messageBox, "Cererea de dezactivare a fost trimisă Owner-ului pentru aprobare.");
        await loadUsers();
      } catch (error) { showMessage(messageBox, error.message, "error"); }
      return;
    }
    profile.is_active = !profile.is_active;
    button.classList.toggle("is-active", profile.is_active);
    button.setAttribute("aria-pressed", String(profile.is_active));
    button.parentElement.querySelector("span").textContent = profile.is_active ? "Activ" : "Inactiv";
    return;
  }

  if (button.dataset.action === "delete") {
    if (isCurrentOwner()) {
      if (!confirm(`Ștergi definitiv contul ${profile.full_name || profile.email}? Această acțiune elimină autentificarea și nu poate fi anulată.`)) return;
      try {
        await invokeManagement({ action:"owner_execute", operation:"delete", target_user_id:profile.id });
        showMessage(messageBox, "Contul a fost șters definitiv de Owner.");
        await loadUsers();
      } catch (error) { showMessage(messageBox, error.message, "error"); }
    } else {
      const reason = prompt("Motivul ștergerii contului (obligatoriu pentru aprobarea Owner-ului):");
      if (reason === null) return;
      try {
        await invokeManagement({ action:"request", operation:"delete", target_user_id:profile.id, reason:reason.trim() });
        showMessage(messageBox, "Cererea de ștergere a fost trimisă Owner-ului.");
        await loadUsers();
      } catch (error) { showMessage(messageBox, error.message, "error"); }
    }
    return;
  }

  if (button.dataset.action !== "save") return;
  const nextRole = row.querySelector("select[data-field='role']")?.value || profile.role;
  button.disabled = true;
  const originalHtml = button.innerHTML;
  button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Se salvează';
  try {
    if (isCurrentOwner() && profile.is_active !== Boolean(profileById(profile.id)?.is_active)) {
      await invokeManagement({ action:"owner_execute", operation:profile.is_active ? "reactivate" : "deactivate", target_user_id:profile.id });
    }
    const { error } = await supabase.from("profiles").update({ role:nextRole, ...(isCurrentOwner() ? { is_active:profile.is_active } : {}) }).eq("id", profile.id);
    if (error) throw error;
    showMessage(messageBox, "Drepturile utilizatorului au fost actualizate.");
    await loadUsers();
  } catch (error) {
    console.error("BCB user update error:", error);
    showMessage(messageBox, error.message || "Modificarea nu a putut fi salvată.", "error");
    await loadUsers();
  } finally {
    button.disabled = false;
    button.innerHTML = originalHtml;
  }
});

document.addEventListener("click", async event => {
  const button = event.target.closest("#bcb-owner-approvals button[data-review]");
  if (!button || !isCurrentOwner()) return;
  const card = button.closest("[data-request-id]");
  if (!card) return;
  button.disabled = true;
  try {
    await invokeManagement({ action:"review", request_id:card.dataset.requestId, decision:button.dataset.review });
    showMessage(messageBox, button.dataset.review === "approved" ? "Cererea a fost aprobată și executată." : "Cererea a fost respinsă.");
    await loadUsers();
  } catch (error) {
    showMessage(messageBox, error.message, "error");
    button.disabled = false;
  }
});

inviteForm?.addEventListener("submit", async event => {
  event.preventDefault();
  if (inviteBusy) return;
  const fullName = inviteName?.value.trim() || "";
  const email = inviteEmail?.value.trim().toLowerCase() || "";
  const role = inviteRole?.value === "admin" ? "admin" : "editor";
  if (!fullName || !email) { showMessage(inviteMessage, "Completează numele și adresa de email.", "error"); return; }
  if (profiles.some(p => (p.email || "").toLowerCase() === email)) { showMessage(inviteMessage, "Există deja un utilizator cu această adresă de email.", "error"); return; }

  inviteBusy = true; inviteButton.disabled = true;
  const originalHtml = inviteButton.innerHTML;
  inviteButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Se trimite…';
  showMessage(inviteMessage, "Se trimite invitația securizată…", "loading");
  try {
    const { data, error } = await supabase.functions.invoke("invite-bcb-user", { body:{ email, full_name:fullName, role } });
    if (error || !data?.success) {
      let text = data?.error || "Invitația nu a putut fi trimisă.";
      if (error?.context) { try { const details = await error.context.json(); if (details?.error) text = details.error; } catch (_) {} }
      throw new Error(text);
    }
    inviteForm.reset(); if (inviteRole) inviteRole.value = "editor";
    showMessage(inviteMessage, `Invitația a fost trimisă către ${email}.`, "success");
    await loadUsers(); inviteName?.focus();
  } catch (error) {
    console.error("BCB invitation error:", error);
    showMessage(inviteMessage, error?.message || "Invitația nu a putut fi trimisă.", "error");
  } finally {
    inviteBusy = false; inviteButton.disabled = false; inviteButton.innerHTML = originalHtml;
  }
});

(async function init() {
  bindAdminLogout();
  const ctx = await requireStaffContext({ adminOnly:true });
  if (!ctx) return;
  currentProfile = ctx.profile;
  if (userName) userName.textContent = currentProfile.full_name || (isOwnerProfile(currentProfile) ? "Owner BCB" : "Administrator BCB");
  const roleLabel = document.querySelector(".bcb-admin-user-card span");
  if (roleLabel) roleLabel.textContent = isOwnerProfile(currentProfile) ? "Owner" : "Administrator";
  await loadUsers();
})();
