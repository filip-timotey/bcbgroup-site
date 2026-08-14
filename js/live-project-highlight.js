import { supabase } from "./supabase-client.js";

const heroSelectors = [
  ".bcb26-hero",
  ".about26-hero",
  ".services26-hero",
  ".social26-hero"
];

const hero = heroSelectors
  .map((selector) => document.querySelector(selector))
  .find(Boolean);

if (hero) {
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "css/live-project-highlight.css";
  css.dataset.bcbLiveProjectCss = "true";

  if (!document.querySelector('[data-bcb-live-project-css="true"]')) {
    document.head.appendChild(css);
  }

  const section = document.createElement("section");
  section.className = "bcb-live-highlight";
  section.hidden = true;
  section.setAttribute("aria-label", "Proiect BCB Group în desfășurare");

  hero.insertAdjacentElement("afterend", section);

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const publicUrl = (path) =>
    supabase.storage.from("project-media").getPublicUrl(path).data.publicUrl;

  async function loadLiveProject() {
    const { data: project, error } = await supabase
      .from("projects")
      .select("id, title, location, short_description, description, progress, current_stage, cover_path, published_at, updated_at")
      .eq("status", "in_progress")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("BCB LIVE project error:", error);
      return;
    }

    if (!project) return;

    const { data: media, error: mediaError } = await supabase
      .from("project_media")
      .select("id, media_type, storage_path, is_cover, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });

    if (mediaError) {
      console.error("BCB LIVE project media error:", mediaError);
    }

    const mediaItems = media || [];
    const coverItem = project.cover_path
      ? mediaItems.find((item) => item.storage_path === project.cover_path)
      : mediaItems.find((item) => item.is_cover && item.media_type === "image") ||
        mediaItems.find((item) => item.media_type === "image");

    const coverUrl = coverItem ? publicUrl(coverItem.storage_path) : "";
    const progress = Math.max(0, Math.min(100, Number(project.progress || 0)));
    const description = project.short_description || project.description ||
      "Urmărește evoluția celui mai recent proiect BCB Group direct din teren.";

    section.innerHTML = `
      <div class="bcb-live-highlight-shell">
        <a class="bcb-live-highlight-media" href="proiecte.html#proiecte-live" aria-label="Vezi proiectul ${escapeHtml(project.title)}">
          ${coverUrl
            ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(project.title)}" loading="lazy">`
            : `<div class="bcb-live-highlight-placeholder"><i class="fa-solid fa-building"></i></div>`}

          <div class="bcb-live-highlight-live">
            <span class="bcb-live-highlight-dot"></span>
            LIVE · ÎN DESFĂȘURARE
          </div>

          <div class="bcb-live-highlight-photo-meta">
            <span><i class="fa-regular fa-images"></i> ${mediaItems.length} media</span>
          </div>
        </a>

        <div class="bcb-live-highlight-content">
          <div class="bcb-live-highlight-topline">
            <span class="bcb-live-highlight-kicker">BCB GROUP · PROIECT LIVE</span>
            <span class="bcb-live-highlight-sync"><i class="fa-solid fa-arrows-rotate"></i> Actualizat din teren</span>
          </div>

          <h2>${escapeHtml(project.title)}</h2>

          <div class="bcb-live-highlight-meta">
            <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(project.location || "Bihor")}</span>
            ${project.current_stage
              ? `<span><i class="fa-solid fa-helmet-safety"></i> ${escapeHtml(project.current_stage)}</span>`
              : ""}
          </div>

          <p>${escapeHtml(description)}</p>

          <div class="bcb-live-highlight-progress-head">
            <span>Progresul proiectului</span>
            <strong>${progress}%</strong>
          </div>

          <div class="bcb-live-highlight-progress" aria-label="Progres ${progress}%">
            <span style="width:${progress}%"></span>
          </div>

          <div class="bcb-live-highlight-actions">
            <a href="proiecte.html#proiecte-live" class="bcb-live-highlight-primary">
              Vezi proiectul LIVE
              <i class="fa-solid fa-arrow-right"></i>
            </a>

            <a href="contact.html#oferta" class="bcb-live-highlight-secondary">
              <i class="fa-regular fa-file-lines"></i>
              Solicită ofertă
            </a>
          </div>
        </div>
      </div>
    `;

    section.hidden = false;

    requestAnimationFrame(() => {
      section.classList.add("is-visible");
    });
  }

  loadLiveProject();
}
