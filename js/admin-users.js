import { supabase } from "./supabase-client.js";
import { requireStaffContext, bindAdminLogout } from "./admin-session.js";

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
let inviteBusy = false;
let loadToken = 0;

const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const initials = (name = "BCB") => (
  String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "BCB"
).slice(0, 3);

function showMessage(box, text, type = "success") {
  if (!box) return;
  box.hidden = false;
  box.className = `${box === inviteMessage ? "bcb-users-invite-message" : "bcb-users-message"} is-${type}`;
  box.textContent = text;
}

function updateStats() {
  if (totalBox) totalBox.textContent = profiles.length;
  if (activeBox) activeBox.textContent = profiles.filter((p) => p.is_active).length;
  if (adminsBox) adminsBox.textContent = profiles.filter((p) => p.role === "admin").length;
  if (editorsBox) editorsBox.textContent = profiles.filter((p) => p.role === "editor").length;
}

function renderUsers() {
  if (!usersList) return;
  if (!profiles.length) {
    usersList.innerHTML = '<div class="bcb-admin-empty">Nu există utilizatori disponibili.</div>';
    return;
  }

  const activeAdmins = profiles.filter((p) => p.role === "admin" && p.is_active).length;
  usersList.innerHTML = profiles.map((profile) => {
    const isCurrent = profile.id === currentProfile?.id;
    const lastAdmin = profile.role === "admin" && profile.is_active && activeAdmins === 1;
    const identifier = profile.full_name || profile.email || "Utilizator BCB";

    return `<article class="bcb-user-row" data-user-id="${esc(profile.id)}">
      <div class="bcb-user-main">
        <div class="bcb-user-avatar">${esc(initials(identifier))}</div>
        <div>
          <h3>${esc(identifier)}</h3>
          <p>${esc(profile.email || `ID · ${profile.id.slice(0, 8)}…`)}</p>
          ${isCurrent ? '<span class="bcb-user-badge"><i class="fa-solid fa-crown"></i> Contul tău</span>' : ""}
        </div>
      </div>
      <div>
        <select data-field="role" aria-label="Rol utilizator" ${lastAdmin ? "disabled" : ""}>
          <option value="editor" ${profile.role === "editor" ? "selected" : ""}>Editor</option>
          <option value="admin" ${profile.role === "admin" ? "selected" : ""}>Administrator</option>
        </select>
      </div>
      <div class="bcb-user-status">
        <button type="button" class="bcb-user-toggle ${profile.is_active ? "is-active" : ""}" data-action="toggle" aria-pressed="${profile.is_active}" ${lastAdmin ? "disabled" : ""}></button>
        <span>${profile.is_active ? "Activ" : "Inactiv"}</span>
      </div>
      <button type="button" class="bcb-user-save" data-action="save"><i class="fa-solid fa-floppy-disk"></i> Salvează</button>
    </article>`;
  }).join("");
}

async function loadUsers() {
  const token = ++loadToken;
  if (usersList) usersList.innerHTML = '<div class="bcb-admin-empty">Se încarcă utilizatorii…</div>';

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,role,is_active,created_at,updated_at")
    .order("created_at", { ascending: true });

  if (token !== loadToken) return;

  if (error) {
    console.error("BCB users load error:", error);
    if (usersList) usersList.innerHTML = '<div class="bcb-admin-empty">Nu am putut încărca utilizatorii. Reîncearcă pagina.</div>';
    showMessage(messageBox, "Lista de utilizatori nu a putut fi sincronizată cu Supabase.", "error");
    return;
  }

  profiles = data || [];
  updateStats();
  renderUsers();
}

usersList?.addEventListener("click", async (event) => {
  const row = event.target.closest("[data-user-id]");
  const button = event.target.closest("button[data-action]");
  if (!row || !button || button.disabled) return;

  const profile = profiles.find((x) => x.id === row.dataset.userId);
  if (!profile) return;

  if (button.dataset.action === "toggle") {
    profile.is_active = !profile.is_active;
    button.classList.toggle("is-active", profile.is_active);
    button.setAttribute("aria-pressed", String(profile.is_active));
    button.parentElement.querySelector("span").textContent = profile.is_active ? "Activ" : "Inactiv";
    return;
  }

  if (button.dataset.action !== "save") return;

  const nextRole = row.querySelector("select[data-field='role']")?.value || profile.role;
  button.disabled = true;
  const originalHtml = button.innerHTML;
  button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Se salvează';

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ role: nextRole, is_active: profile.is_active })
      .eq("id", profile.id);

    if (error) throw error;
    showMessage(messageBox, "Drepturile utilizatorului au fost actualizate.");
    await loadUsers();
  } catch (error) {
    console.error("BCB user update error:", error);
    showMessage(messageBox, "Modificarea nu a putut fi salvată. Trebuie să rămână cel puțin un administrator activ.", "error");
    await loadUsers();
  } finally {
    button.disabled = false;
    button.innerHTML = originalHtml;
  }
});

inviteForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (inviteBusy) return;

  const fullName = inviteName?.value.trim() || "";
  const email = inviteEmail?.value.trim().toLowerCase() || "";
  const role = inviteRole?.value === "admin" ? "admin" : "editor";

  if (!fullName || !email) {
    showMessage(inviteMessage, "Completează numele și adresa de email.", "error");
    return;
  }

  if (profiles.some((p) => (p.email || "").toLowerCase() === email)) {
    showMessage(inviteMessage, "Există deja un utilizator cu această adresă de email.", "error");
    return;
  }

  inviteBusy = true;
  inviteButton.disabled = true;
  const originalHtml = inviteButton.innerHTML;
  inviteButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Se trimite…';
  showMessage(inviteMessage, "Se trimite invitația securizată…", "loading");

  try {
    const { data, error } = await supabase.functions.invoke("invite-bcb-user", {
      body: { email, full_name: fullName, role }
    });

    if (error || !data?.success) {
      let text = data?.error || "Invitația nu a putut fi trimisă.";
      if (error?.context) {
        try {
          const details = await error.context.json();
          if (details?.error) text = details.error;
        } catch (_) {}
      }
      throw new Error(text);
    }

    inviteForm.reset();
    if (inviteRole) inviteRole.value = "editor";
    showMessage(inviteMessage, `Invitația a fost trimisă către ${email}. Poți invita imediat următorul utilizator.`, "success");
    await loadUsers();
    inviteName?.focus();
  } catch (error) {
    console.error("BCB invitation error:", error);
    showMessage(inviteMessage, error?.message || "Invitația nu a putut fi trimisă.", "error");
  } finally {
    inviteBusy = false;
    inviteButton.disabled = false;
    inviteButton.innerHTML = originalHtml;
  }
});

(async function init() {
  bindAdminLogout();
  const ctx = await requireStaffContext({ adminOnly: true });
  if (!ctx) return;

  currentProfile = ctx.profile;
  if (userName) userName.textContent = currentProfile.full_name || "Administrator BCB";
  await loadUsers();
})();
