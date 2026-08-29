import { supabase } from "./supabase-client.js";

const form = document.querySelector("#bcb-admin-login-form");
const emailInput = document.querySelector("#bcb-admin-email");
const passwordInput = document.querySelector("#bcb-admin-password");
const submitButton = document.querySelector("#bcb-admin-submit");
const message = document.querySelector("#bcb-admin-message");
const forgotButton = document.querySelector("#bcb-forgot-password");
const helpBox = document.querySelector("#bcb-auth-help");
const sendResetButton = document.querySelector("#bcb-send-reset");
const cancelResetButton = document.querySelector("#bcb-cancel-reset");
const RESET_REDIRECT = "https://bcbgroup.ro/admin/set-password.html";

function setMessage(text = "", type = "") {
  if (!message) return;
  message.textContent = text;
  message.dataset.type = type;
}

function setLoginBusy(busy) {
  if (!submitButton) return;
  submitButton.disabled = busy;
  submitButton.classList.toggle("is-loading", busy);
}

function loginErrorMessage(error) {
  const code = String(error?.code || "").toLowerCase();
  const text = String(error?.message || "").toLowerCase();
  if (!navigator.onLine || text.includes("failed to fetch") || text.includes("network")) return "Nu există conexiune stabilă la internet. Verifică rețeaua și încearcă din nou.";
  if (code.includes("email_not_confirmed") || text.includes("email not confirmed")) return "Adresa de email nu este încă verificată. Verifică mesajele primite pe email.";
  if (code.includes("over_request_rate_limit") || text.includes("rate limit")) return "Au fost prea multe încercări într-un timp scurt. Așteaptă puțin și încearcă din nou.";
  if (code.includes("invalid_credentials") || text.includes("invalid login credentials")) return "Emailul sau parola nu sunt corecte. Dacă nu îți amintești parola, folosește „Ai uitat parola?”.";
  return "Autentificarea nu a putut fi finalizată. Poți reîncerca sau reseta parola.";
}

async function redirectExistingSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return;
    if (!data.session) return;
    const { data: trusted } = await supabase.auth.getUser();
    if (trusted?.user) window.location.replace("dashboard.html");
  } catch (error) {
    console.warn("BCB existing session check:", error);
  }
}

async function sendPasswordReset() {
  const email = String(emailInput?.value || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    setMessage("Introdu mai întâi adresa de email a contului tău.", "error");
    emailInput?.focus();
    return;
  }
  sendResetButton.disabled = true;
  setMessage("Se pregătește linkul securizat…", "loading");
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: RESET_REDIRECT });
    if (error) throw error;
    setMessage("Dacă această adresă aparține unui cont BCB, vei primi un email cu linkul de resetare. Verifică și folderul Spam.", "success");
  } catch (error) {
    console.error("BCB password recovery:", error);
    const text = String(error?.message || "").toLowerCase();
    if (!navigator.onLine || text.includes("failed to fetch") || text.includes("network")) setMessage("Nu am putut contacta serviciul de autentificare. Verifică internetul și încearcă din nou.", "error");
    else if (text.includes("rate limit")) setMessage("Ai solicitat recent un link. Așteaptă aproximativ un minut înainte de o nouă solicitare.", "error");
    else setMessage("Linkul nu a putut fi trimis acum. Încearcă din nou peste puțin timp.", "error");
  } finally {
    sendResetButton.disabled = false;
  }
}

forgotButton?.addEventListener("click", () => {
  helpBox.hidden = false;
  forgotButton.setAttribute("aria-expanded", "true");
  setMessage("", "");
  emailInput?.focus();
});
cancelResetButton?.addEventListener("click", () => {
  helpBox.hidden = true;
  forgotButton?.setAttribute("aria-expanded", "false");
  setMessage("", "");
});
sendResetButton?.addEventListener("click", sendPasswordReset);

redirectExistingSession();

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    if (!email || !password) {
      setMessage("Completează adresa de email și parola.", "error");
      return;
    }
    setLoginBusy(true);
    setMessage("Se verifică accesul…", "loading");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        setMessage(loginErrorMessage(error), "error");
        return;
      }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("id, full_name, role, is_active").eq("id", data.user.id).single();
      if (profileError || !profile?.is_active) {
        await supabase.auth.signOut();
        setMessage("Contul există, dar accesul BCB nu este activ. Contactează un administrator BCB pentru reactivare.", "error");
        return;
      }
      window.location.replace("dashboard.html");
    } catch (error) {
      console.error("BCB login:", error);
      setMessage(loginErrorMessage(error), "error");
    } finally {
      setLoginBusy(false);
    }
  });
}
