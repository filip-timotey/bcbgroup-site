import { supabase } from "./supabase-client.js";

const page = document.querySelector(".projects26-page");
const hero = document.querySelector(".projects26-hero");

if (page && hero) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "css/pages/projects-live.css";
  document.head.appendChild(stylesheet);

  const section = document.createElement("section");
  section.className = "bcb-live-projects";
  section.id = "proiecte-live";
  section.innerHTML = `
    <div class="bcb-live-projects-shell">
      <div class="bcb-live-projects-heading">
        <div>
          <span class="bcb-live-projects-kicker">BCB Project Manager · Live</span>
          <h2>Proiecte publicate direct din teren.</h2>
        </div>
        <p>Fotografiile, videoclipurile și progresul sunt actualizate de echipa BCB și apar automat aici.</p>
      </div>
      <div id="bcb-live-projects-grid" class="bcb-live-projects-grid">
        <div class="bcb-live-empty">Se încarcă proiectele…</div>
      </div>
    </div>`;
  hero.insertAdjacentElement("afterend", section);

  const grid = section.querySelector("#bcb-live-projects-grid");

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const statusLabel = (status) => status === "completed" ? "Finalizat" : "În desfășurare";
  const publicUrl = (path) => supabase.storage.from("project-media").getPublicUrl(path).data.publicUrl;

  async function loadProjects() {
    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, title, location, short_description, description, status, progress, current_stage, cover_path, published_at")
      .in("status", ["in_progress", "completed"])
      .not("published_at", "is", null)
      .order("published_at", { ascending: false });

    if (error) {
      console.error("BCB public projects error:", error);
      grid.innerHTML = '<div class="bcb-live-empty">Proiectele nu au putut fi încărcate momentan.</div>';
      return;
    }

    const allProjects = projects || [];
    if (!allProjects.length) {
      section.hidden = true;
      return;
    }

    const ids = allProjects.map((project) => project.id);
    const { data: media, error: mediaError } = await supabase
      .from("project_media")
      .select("id, project_id, media_type, storage_path, title, is_cover, sort_order, created_at")
      .in("project_id", ids)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (mediaError) console.error("BCB public media error:", mediaError);
    const mediaItems = media || [];

    grid.innerHTML = allProjects.map((project) => {
      const projectMedia = mediaItems.filter((item) => item.project_id === project.id);
      const coverItem = project.cover_path
        ? projectMedia.find((item) => item.storage_path === project.cover_path)
        : projectMedia.find((item) => item.is_cover) || projectMedia.find((item) => item.media_type === "image");
      const cover = coverItem ? publicUrl(coverItem.storage_path) : null;
      const description = project.short_description || project.description || "Urmărește evoluția acestui proiect BCB Group.";
      const progress = Math.max(0, Math.min(100, Number(project.progress || 0)));

      const gallery = projectMedia.length ? `
        <div class="bcb-live-gallery" hidden>
          <div class="bcb-live-gallery-grid">
            ${projectMedia.map((item) => {
              const url = publicUrl(item.storage_path);
              return item.media_type === "video"
                ? `<div class="bcb-live-media"><video src="${escapeHtml(url)}" controls playsinline preload="metadata"></video></div>`
                : `<div class="bcb-live-media"><img src="${escapeHtml(url)}" alt="${escapeHtml(project.title)}" loading="lazy"></div>`;
            }).join("")}
          </div>
        </div>` : "";

      return `
        <article class="bcb-live-project">
          <div class="bcb-live-project-cover">
            ${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(project.title)}" loading="lazy">` : '<div class="bcb-live-project-cover-placeholder"><i class="fa-solid fa-building"></i></div>'}
            <div class="bcb-live-status"><span></span>${escapeHtml(statusLabel(project.status))}</div>
          </div>
          <div class="bcb-live-project-content">
            <div class="bcb-live-project-meta">
              <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(project.location || "Bihor")}</span>
              <span>${projectMedia.length} fișier(e) media</span>
            </div>
            <h3>${escapeHtml(project.title)}</h3>
            <p class="bcb-live-project-description">${escapeHtml(description)}</p>
            <div class="bcb-live-progress-meta"><span>Progres proiect</span><strong>${progress}%</strong></div>
            <div class="bcb-live-progress-track"><span style="width:${progress}%"></span></div>
            ${project.current_stage ? `<div class="bcb-live-stage">Etapa curentă: <strong>${escapeHtml(project.current_stage)}</strong></div>` : ""}
            ${projectMedia.length ? `<button class="bcb-live-gallery-toggle" type="button"><i class="fa-regular fa-images"></i> Vezi foto & video <i class="fa-solid fa-chevron-down"></i></button>` : ""}
          </div>
          ${gallery}
        </article>`;
    }).join("");

    grid.addEventListener("click", (event) => {
      const button = event.target.closest(".bcb-live-gallery-toggle");
      if (!button) return;
      const article = button.closest(".bcb-live-project");
      const gallery = article?.querySelector(".bcb-live-gallery");
      if (!gallery) return;
      gallery.hidden = !gallery.hidden;
      button.querySelector(".fa-chevron-down")?.classList.toggle("fa-rotate-180", !gallery.hidden);
    });

    const proof = document.querySelector(".projects26-hero-proof div:first-child strong");
    if (proof) proof.textContent = String(allProjects.length).padStart(2, "0");
  }

  loadProjects();
}
