import { supabase } from "./supabase-client.js";
import { SITE_EDITOR_FIELDS } from "./site-editor-registry.js";

function setTextNode(element, ordinal, value) {
  if (!element) return;
  const nodes = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
  if (nodes[ordinal]) nodes[ordinal].nodeValue = ` ${value} `;
}

function applyField(field, value) {
  const element = document.querySelector(field.selector);
  if (!element || value == null || value === "") return;

  if (field.type === "text") {
    element.textContent = value;
    return;
  }

  if (field.type === "textnode") {
    setTextNode(element, Number(field.node || 0), value);
    return;
  }

  if (field.type === "image") {
    element.setAttribute("src", value);
    return;
  }

  if (field.type === "background") {
    element.style.backgroundImage = `url("${String(value).replaceAll('"', '%22')}")`;
  }
}

async function loadSiteContent() {
  const { data, error } = await supabase
    .from("site_content")
    .select("content_key, value");

  if (error) {
    // Site Editor poate să nu fie activat încă în baza de date.
    return;
  }

  const overrides = new Map((data || []).map((item) => [item.content_key, item.value]));

  SITE_EDITOR_FIELDS.forEach((field) => {
    if (!overrides.has(field.key)) return;
    applyField(field, overrides.get(field.key));
  });
}

loadSiteContent();
