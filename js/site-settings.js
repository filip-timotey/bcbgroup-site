import { supabase } from "./supabase-client.js";
import { DEFAULT_SITE_SETTINGS } from "./site-settings-registry.js";

let settings = { ...DEFAULT_SITE_SETTINGS };

function digits(value = "") { return String(value).replace(/\D/g, ""); }

function replaceText(root, from, to) {
  if (!root || !from || from === to) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT","STYLE","TEXTAREA","INPUT","OPTION"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return node.nodeValue.includes(from) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => { node.nodeValue = node.nodeValue.split(from).join(to); });
}

function setMarkedText() {
  document.querySelectorAll("[data-site-setting-text]").forEach(el => {
    const key = el.dataset.siteSettingText;
    if (settings[key] != null) el.textContent = settings[key];
  });
}

function updateTechnicalLinks() {
  const phone = digits(settings.phone_e164);
  const whatsapp = digits(settings.whatsapp_e164);
  const email = String(settings.email || "").trim();

  if (phone) document.querySelectorAll('a[href^="tel:"]').forEach(a => a.setAttribute("href", `tel:+${phone}`));
  if (email) document.querySelectorAll('a[href^="mailto:"]').forEach(a => a.setAttribute("href", `mailto:${email}`));
  if (whatsapp) document.querySelectorAll('a[href*="wa.me/"]').forEach(a => a.setAttribute("href", `https://wa.me/${whatsapp}`));

  const socials = [
    ["instagram.com", settings.instagram_url],
    ["facebook.com", settings.facebook_url],
    ["tiktok.com", settings.tiktok_url],
    ["linkedin.com", settings.linkedin_url],
    ["youtube.com", settings.youtube_url]
  ];
  socials.forEach(([needle, url]) => {
    if (!url) return;
    document.querySelectorAll(`a[href*="${needle}"]`).forEach(a => a.setAttribute("href", url));
  });

  document.querySelectorAll("[data-site-social]").forEach(a => {
    const key = `${a.dataset.siteSocial}_url`;
    const url = settings[key];
    if (!url) { a.hidden = true; return; }
    a.hidden = false;
    a.setAttribute("href", url);
  });
}

function updateKnownText() {
  const pairs = [
    [DEFAULT_SITE_SETTINGS.brand_name, settings.brand_name],
    [DEFAULT_SITE_SETTINGS.brand_long_name, settings.brand_long_name],
    [DEFAULT_SITE_SETTINGS.legal_name, settings.legal_name],
    [DEFAULT_SITE_SETTINGS.cui, settings.cui],
    [DEFAULT_SITE_SETTINGS.trade_register, settings.trade_register],
    [DEFAULT_SITE_SETTINGS.caen, settings.caen],
    [DEFAULT_SITE_SETTINGS.phone_display, settings.phone_display],
    [DEFAULT_SITE_SETTINGS.email, settings.email],
    [DEFAULT_SITE_SETTINGS.working_hours, settings.working_hours],
    [DEFAULT_SITE_SETTINGS.service_area, settings.service_area],
    [DEFAULT_SITE_SETTINGS.headquarters, settings.headquarters],
    [DEFAULT_SITE_SETTINGS.service_area_note, settings.service_area_note],
    [DEFAULT_SITE_SETTINGS.footer_slogan, settings.footer_slogan],
    [DEFAULT_SITE_SETTINGS.footer_legal_line, settings.footer_legal_line],
    [DEFAULT_SITE_SETTINGS.footer_verse, settings.footer_verse],
    [DEFAULT_SITE_SETTINGS.footer_verse_reference, settings.footer_verse_reference],
    [DEFAULT_SITE_SETTINGS.copyright_text, settings.copyright_text]
  ];
  pairs.forEach(([from, to]) => { if (to) replaceText(document.body, from, to); });

  document.querySelectorAll(".bcb26-header-cta span").forEach(el => { if (settings.quote_cta) el.textContent = settings.quote_cta; });
  document.querySelectorAll(".bcb26-mobile-actions a[href*='contact.html#oferta']").forEach(el => {
    const icon = el.querySelector("i");
    el.textContent = settings.quote_cta || DEFAULT_SITE_SETTINGS.quote_cta;
    if (icon) el.prepend(icon);
  });
}

function applySettings() {
  setMarkedText();
  updateTechnicalLinks();
  updateKnownText();
}

async function loadSettings() {
  const { data, error } = await supabase.from("site_settings").select("setting_key, setting_value");
  if (!error) {
    (data || []).forEach(row => { if (row.setting_key in settings) settings[row.setting_key] = row.setting_value ?? ""; });
  }
  applySettings();
}

document.addEventListener("bcb:components-loaded", applySettings);
loadSettings();
