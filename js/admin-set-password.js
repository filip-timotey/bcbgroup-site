import { supabase } from "./supabase-client.js";

const form = document.querySelector("#bcb-setpass-form");
const passwordInput = document.querySelector("#bcb-setpass-password");
const confirmInput = document.querySelector("#bcb-setpass-confirm");
const submitButton = document.querySelector("#bcb-setpass-submit");
const messageBox = document.querySelector("#bcb-setpass-message");

function showMessage(text, type = "info") {
  if (!messageBox) return;
  messageBox.hidden = false;
  messageBox.className = `bcb-setpass-message is-${type}`;
  messageBox.textContent = text;
}

async function ensureInviteSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    showMessage("Linkul de invitație nu a putut fi verificat. Deschide din nou linkul primit pe email.", "error");
    return false;
  }

  if (!data.session) {
    showMessage("Invitația nu mai este activă sau linkul a expirat. Cere administratorului BCB să trimită o invitație nouă.", "error");
    if (form) form.hidden = true;
    return false;
  }

  return true;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = passwordInput?.value || "";
  const confirmation = confirmInput?.value || "";

  if (password.length < 10) {
    showMessage("Parola trebuie să aibă cel puțin 10 caractere.", "error");
    return;
  }

  if (password !== confirmation) {
    showMessage("Parolele introduse nu coincid.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.innerHTML = '<span>Se salvează…</span><i class="fa-solid fa-circle-notch fa-spin"></i>';

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error(error);
    submitButton.disabled = false;
    submitButton.innerHTML = '<span>Salvează parola</span><i class="fa-solid fa-arrow-right"></i>';
    showMessage("Parola nu a putut fi salvată. Încearcă din nou sau cere o invitație nouă.", "error");
    return;
  }

  showMessage("Parola a fost setată. Vei fi redirecționat către BCB Project Manager.", "success");

  window.setTimeout(() => {
    window.location.replace("dashboard.html");
  }, 1200);
});

ensureInviteSession();
