import { supabase } from "./supabase-client.js";

const form = document.getElementById("oferta");

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector("button[type='submit']");
    const originalButton = submitButton?.innerHTML;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Se trimite...';
    }

    const fd = new FormData(form);
    const payload = {
      full_name: String(fd.get("Nume client") || "").trim(),
      phone: String(fd.get("Telefon") || "").trim(),
      email: String(fd.get("email") || "").trim() || null,
      location: String(fd.get("Zona") || "").trim() || null,
      project_type: String(fd.get("Tip proiect") || "").trim() || null,
      estimated_budget: String(fd.get("Buget estimativ") || "").trim() || null,
      desired_start: String(fd.get("Perioada dorită") || "").trim() || null,
      project_stage: String(fd.get("Etapa proiectului") || "").trim() || null,
      message: String(fd.get("Mesaj") || "").trim(),
      status: "new",
      source: "website"
    };

    let storedInManager = false;

    try {
      const { error } = await supabase.from("quote_requests").insert(payload);
      storedInManager = !error;
      if (error) console.warn("BCB quote sync not available yet:", error.message);
    } catch (error) {
      console.warn("BCB quote sync error:", error);
    }

    try {
      const response = await fetch("https://formspree.io/f/xkolagbg", {
        method: "POST",
        body: fd,
        headers: { Accept: "application/json" }
      });

      if (!response.ok && !storedInManager) throw new Error("Form submission failed");
      window.location.href = "multumim.html";
    } catch (error) {
      console.error("BCB contact form error:", error);
      alert("A apărut o problemă. Te rugăm să încerci din nou sau să ne contactezi telefonic.");
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButton;
      }
    }
  });
}
