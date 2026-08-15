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

function safeManagerUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "admin/";
  if (/^https:\/\//i.test(url)) return url;
  if (/^(\/)?admin\/?(?:[?#].*)?$/i.test(url)) return url;
  return "admin/";
}

function createManagerButton(settings) {
  if (window.location.pathname.includes("/admin/")) return;
  if (document.querySelector(".bcb-family-manager")) return;

  const badge = String(settings.manager_badge || DEFAULT_SITE_SETTINGS.manager_badge).trim();
  const title = String(settings.manager_title || DEFAULT_SITE_SETTINGS.manager_title).trim();
  const aria = String(settings.manager_aria_label || DEFAULT_SITE_SETTINGS.manager_aria_label).trim();

  const link = document.createElement("a");
  link.className = "bcb-family-manager";
  link.href = safeManagerUrl(settings.manager_url);
  link.setAttribute("aria-label", aria);
  link.innerHTML = `
    <span class="bcb-family-manager-icon" aria-hidden="true"><i class="fa-solid fa-people-roof"></i></span>
    <span class="bcb-family-manager-copy">
      <small></small>
      <strong></strong>
    </span>
    <i class="fa-solid fa-arrow-right bcb-family-manager-arrow" aria-hidden="true"></i>
  `;
  link.querySelector("small").textContent = badge;
  link.querySelector("strong").textContent = title;
  document.body.appendChild(link);
}

function createSocialDock(settings) {
  const area = document.querySelector(".bcb26-floating-area");
  if (!area || area.querySelector(".bcb26-social-dock")) return;

  const links = [
    { key:"instagram_url", label:"Instagram", icon:"fa-instagram", className:"is-instagram" },
    { key:"facebook_url", label:"Facebook", icon:"fa-facebook-f", className:"is-facebook" },
    { key:"tiktok_url", label:"TikTok", icon:"fa-tiktok", className:"is-tiktok" },
    { key:"linkedin_url", label:"LinkedIn", icon:"fa-linkedin-in", className:"is-linkedin" },
    { key:"youtube_url", label:"YouTube", icon:"fa-youtube", className:"is-youtube", fallback:"social-media.html" }
  ].filter(item => settings[item.key] || item.fallback);

  if (!links.length) return;

  const dock = document.createElement("div");
  dock.className = "bcb26-social-dock reveal delay-4";
  dock.setAttribute("aria-label", "Rețele sociale BCB Group");
  dock.innerHTML = links.map((item, index) => {
    const configuredUrl = String(settings[item.key] || "").trim();
    const href = configuredUrl || item.fallback;
    const syncAttribute = configuredUrl ? `data-site-social="${item.key.replace("_url", "")}"` : "";
    return `
      <a
        class="bcb26-social-link ${item.className}"
        href="${href}"
        target="${configuredUrl ? "_blank" : "_self"}"
        rel="${configuredUrl ? "noopener noreferrer" : ""}"
        aria-label="${item.label}"
        data-social-index="${index}"
        ${syncAttribute}>
        <i class="fa-brands ${item.icon}" aria-hidden="true"></i>
      </a>`;
  }).join("");

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
  const settings = await getSettings();
  createManagerButton(settings);
  createSocialDock(settings);
}

initPublicAccessDock();
