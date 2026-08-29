import { supabase } from "./supabase-client.js";

const form = document.querySelector("#bcb-setpass-form");
const passwordInput = document.querySelector("#bcb-setpass-password");
const confirmInput = document.querySelector("#bcb-setpass-confirm");
const submitButton = document.querySelector("#bcb-setpass-submit");
const messageBox = document.querySelector("#bcb-setpass-message");
const title = document.querySelector("#bcb-setpass-title");
const description = document.querySelector("#bcb-setpass-description");
let recoveryEventSeen = false;

function showMessage(text, type = "info") {
  if (!messageBox) return;
  messageBox.hidden = false;
  messageBox.className = `bcb-setpass-message is-${type}`;
  messageBox.textContent = text;
}

function showReady(recovery = false) {
  if (title) title.textContent = recovery ? "Resetează parola contului tău." : "Setează parola contului tău.";
  if (description) description.textContent = recovery ? "Linkul de recuperare a fost verificat. Alege acum o parolă nouă." : "Accesul a fost verificat. Alege o parolă sigură pentru contul tău.";
  if (form) form.hidden = false;
}

function recoveryHintFromUrl() {
  const value = `${location.search} ${location.hash}`.toLowerCase();
  return value.includes("type=recovery") || value.includes("type%3drecovery");
}

supabase.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    recoveryEventSeen = true;
    showReady(true);
  }
});

async function ensureSecureSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      showMessage("Linkul nu mai este activ sau a expirat. Revino la autentificare și solicită un link nou.", "error");
      if (form) form.hidden = true;
      return false;
    }
    const { data: trusted, error: userError } = await supabase.auth.getUser();
    if (userError || !trusted?.user) {
      showMessage("Sesiunea de recuperare nu a putut fi verificată. Solicită un link nou.", "error");
      if (form) form.hidden = true;
      return false;
    }
    showReady(recoveryEventSeen || recoveryHintFromUrl());
    return true;
  } catch (error) {
    console.error("BCB password link verification:", error);
    showMessage("Linkul nu a putut fi verificat. Verifică internetul sau solicită un link nou.", "error");
    if (form) form.hidden = true;
    return false;
  }
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
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    showMessage("Parola a fost actualizată cu succes. Vei fi redirecționat către Business Manager.", "success");
    window.setTimeout(() => window.location.replace("dashboard.html"), 1200);
  } catch (error) {
    console.error("BCB password update:", error);
    submitButton.disabled = false;
    submitButton.innerHTML = '<span>Salvează parola</span><i class="fa-solid fa-arrow-right"></i>';
    const text = String(error?.message || "").toLowerCase();
    if (text.includes("same password")) showMessage("Noua parolă trebuie să fie diferită de parola actuală.", "error");
    else if (text.includes("weak") || text.includes("password")) showMessage("Parola nu îndeplinește cerințele de securitate. Folosește minimum 10 caractere și evită parolele ușor de ghicit.", "error");
    else showMessage("Parola nu a putut fi salvată. Solicită un link nou dacă problema persistă.", "error");
  }
});

ensureSecureSession();
