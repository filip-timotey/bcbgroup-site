import { supabase } from "./supabase-client.js";

const form = document.querySelector("#bcb-admin-login-form");
const emailInput = document.querySelector("#bcb-admin-email");
const passwordInput = document.querySelector("#bcb-admin-password");
const submitButton = document.querySelector("#bcb-admin-submit");
const message = document.querySelector("#bcb-admin-message");

function setMessage(text = "", type = "") {
  if (!message) return;
  message.textContent = text;
  message.dataset.type = type;
}

async function redirectExistingSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    window.location.replace("dashboard.html");
  }
}

redirectExistingSession();

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      setMessage("Completează adresa de email și parola.", "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.classList.add("is-loading");
    setMessage("Se verifică accesul…", "loading");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user) {
      submitButton.disabled = false;
      submitButton.classList.remove("is-loading");
      setMessage("Datele de autentificare nu sunt corecte.", "error");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile?.is_active) {
      await supabase.auth.signOut();
      submitButton.disabled = false;
      submitButton.classList.remove("is-loading");
      setMessage("Contul nu are acces activ la BCB Project Manager.", "error");
      return;
    }

    window.location.replace("dashboard.html");
  });
}
