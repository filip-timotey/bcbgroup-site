import { supabase } from "./supabase-client.js";
import { DEFAULT_SITE_SETTINGS } from "./site-settings-registry.js";

function injectStylesheet() {
  if (document.querySelector('link[data-bcb-public-access-dock]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "css/public-access-dock.css";
  link.dataset.bcbPublicAccessDock = "true";
  document.head.appendChild(link);
}

function createManagerButton() {
  if (window.location.pathname.includes("/admin/")) return;
  if (document.querySelector(".bcb-family-manager")) return;

  const link = document.createElement("a");
  link.className = "bcb-family-manager";
  link.href = "admin/";
  link.setAttribute("aria-label", "Deschide BCB Business Manager — acces intern Familia Bocoiu");
  link.innerHTML = `
    <span class="bcb-family-manager-icon" aria-hidden="true"><i class="fa-solid fa-people-roof"></i></span>
    <span class="bcb-family-manager-copy">
      <small>Familia Bocoiu · Acces intern</small>
      <strong>Business Manager</strong>
    </span>
    <i class="fa-solid fa-arrow-right bcb-family-manager-arrow" aria-hidden="true"></i>
  `;
  document.body.appendChild(link);
}

function createSocialDock(settings) {
  const area = document.querySelector(".bcb26-floating-area");
  if (!area || area.querySelector(".bcb26-social-dock")) return;

  const links = [
    { key:"instagram_url", label:"Instagram", icon:"fa-instagram", className:"is-instagram" },
    { key:"facebook_url", label:"Facebook", icon:"fa-facebook-f", className:"is-facebook" },
    { key:"tiktok_url", label:"TikTok", icon:"fa-tiktok", className:"is-tiktok" }
  ].filter(item => settings[item.key]);

  if (!links.length) return;

  const dock = document.createElement("div");
  dock.className = "bcb26-social-dock reveal delay-4";
  dock.setAttribute("aria-label", "Rețele sociale BCB Group");
  dock.innerHTML = `
    <div class="bcb26-social-dock-label">
      <small>Din teren · în timp real</small>
      <strong>Urmărește BCB</strong>
    </div>
    ${links.map(item => `
      <a
        class="bcb26-social-link ${item.className}"
        href="${item.key === "instagram_url" ? settings.instagram_url : item.key === "facebook_url" ? settings.facebook_url : settings.tiktok_url}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="${item.label}"
        data-site-social="${item.key.replace("_url", "")}">
        <i class="fa-brands ${item.icon}" aria-hidden="true"></i>
      </a>`).join("")}
  `;
  area.appendChild(dock);

  requestAnimationFrame(() => dock.classList.add("show"));
}

async function getSettings() {
  const settings = { ...DEFAULT_SITE_SETTINGS };
  try {
    const { data, error } = await supabase.from("site_settings").select("setting_key, setting_value");
    if (!error) {
      (data || []).forEach(row => {
        if (row.setting_key in settings) settings[row.setting_key] = row.setting_value ?? "";
      });
    }
  } catch (error) {
    console.warn("BCB public dock settings fallback:", error);
  }
  return settings;
}

export async function initPublicAccessDock() {
  injectStylesheet();
  createManagerButton();
  const settings = await getSettings();
  createSocialDock(settings);
}

initPublicAccessDock();
