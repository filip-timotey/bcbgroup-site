import { supabase } from "./supabase-client.js";

const userName = document.querySelector("#bcb-admin-user-name");
const usersList = document.querySelector("#bcb-users-list");
const messageBox = document.querySelector("#bcb-users-message");
const totalBox = document.querySelector("#users-total");
const activeBox = document.querySelector("#users-active");
const adminsBox = document.querySelector("#users-admins");
const editorsBox = document.querySelector("#users-editors");
const logoutButton = document.querySelector("#bcb-admin-logout");

let currentProfile = null;
let profiles = [];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(name = "BCB") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "BCB").slice(0, 3);
}

function showMessage(text, type = "success") {
  if (!messageBox) return;
  messageBox.hidden = false;
  messageBox.className = `bcb-users-message is-${type}`;
  messageBox.textContent = text;
}

async function requireAdminSession() {
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

  if (profile.role !== "admin") {
    window.location.replace("dashboard.html");
    return false;
  }

  currentProfile = profile;
  if (userName) userName.textContent = profile.full_name || "Administrator BCB";
  return true;
}

function updateStats() {
  const active = profiles.filter((profile) => profile.is_active).length;
  const admins = profiles.filter((profile) => profile.role === "admin").length;
  const editors = profiles.filter((profile) => profile.role === "editor").length;

  if (totalBox) totalBox.textContent = profiles.length;
  if (activeBox) activeBox.textContent = active;
  if (adminsBox) adminsBox.textContent = admins;
  if (editorsBox) editorsBox.textContent = editors;
}

function renderUsers() {
  if (!usersList) return;

  if (!profiles.length) {
    usersList.innerHTML = '<div class="bcb-admin-empty">Nu există utilizatori disponibili.</div>';
    return;
  }

  const activeAdmins = profiles.filter((profile) => profile.role === "admin" && profile.is_active).length;

  usersList.innerHTML = profiles.map((profile) => {
    const isCurrent = profile.id === currentProfile?.id;
    const isLastActiveAdmin = profile.role === "admin" && profile.is_active && activeAdmins === 1;
    const identifier = profile.full_name || "Utilizator BCB";

    return `
      <article class="bcb-user-row" data-user-id="${escapeHtml(profile.id)}">
        <div class="bcb-user-main">
          <div class="bcb-user-avatar">${escapeHtml(initials(identifier))}</div>
          <div>
            <h3>${escapeHtml(identifier)}</h3>
            <p>ID · ${escapeHtml(profile.id.slice(0, 8))}…</p>
            ${isCurrent ? '<span class="bcb-user-badge"><i class="fa-solid fa-crown"></i> Contul tău</span>' : ""}
          </div>
        </div>

        <div>
          <select data-field="role" aria-label="Rol utilizator" ${isLastActiveAdmin ? "disabled" : ""}>
            <option value="editor" ${profile.role === "editor" ? "selected" : ""}>Editor</option>
            <option value="admin" ${profile.role === "admin" ? "selected" : ""}>Administrator</option>
          </select>
        </div>

        <div class="bcb-user-status">
          <button
            type="button"
            class="bcb-user-toggle ${profile.is_active ? "is-active" : ""}"
            data-action="toggle"
            aria-label="${profile.is_active ? "Dezactivează accesul" : "Activează accesul"}"
            aria-pressed="${profile.is_active ? "true" : "false"}"
            ${isLastActiveAdmin ? "disabled" : ""}
          ></button>
          <span>${profile.is_active ? "Activ" : "Inactiv"}</span>
        </div>

        <button type="button" class="bcb-user-save" data-action="save">
          <i class="fa-solid fa-floppy-disk"></i>
          Salvează
        </button>
      </article>
    `;
  }).join("");
}

async function loadUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    usersList.innerHTML = '<div class="bcb-admin-empty">Nu am putut încărca utilizatorii.</div>';
    return;
  }

  profiles = data || [];
  updateStats();
  renderUsers();
}

usersList?.addEventListener("click", async (event) => {
  const row = event.target.closest("[data-user-id]");
  const actionButton = event.target.closest("button[data-action]");
  if (!row || !actionButton) return;

  const userId = row.dataset.userId;
  const profile = profiles.find((item) => item.id === userId);
  if (!profile) return;

  if (actionButton.dataset.action === "toggle") {
    profile.is_active = !profile.is_active;
    actionButton.classList.toggle("is-active", profile.is_active);
    actionButton.setAttribute("aria-pressed", profile.is_active ? "true" : "false");
    actionButton.parentElement.querySelector("span").textContent = profile.is_active ? "Activ" : "Inactiv";
    return;
  }

  if (actionButton.dataset.action === "save") {
    const roleSelect = row.querySelector("select[data-field='role']");
    const nextRole = roleSelect?.value || profile.role;

    actionButton.disabled = true;
    actionButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Se salvează';

    const { error } = await supabase
      .from("profiles")
      .update({ role: nextRole, is_active: profile.is_active })
      .eq("id", userId);

    actionButton.disabled = false;
    actionButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvează';

    if (error) {
      console.error(error);
      showMessage("Modificarea nu a putut fi salvată. Verifică să existe cel puțin un administrator activ.", "error");
      await loadUsers();
      return;
    }

    showMessage("Drepturile utilizatorului au fost actualizate.");
    await loadUsers();
  }
});

logoutButton?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.replace("index.html");
});

(async function init() {
  if (await requireAdminSession()) await loadUsers();
})();
