import { supabase } from "./supabase-client.js";

const HERO_KEY = "home.hero.background";
const MAX_VIDEO = 150 * 1024 * 1024;
const ACCEPTED_MEDIA = "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm";

function getHeroCard() {
  return document.querySelector(`[data-field-key="${HERO_KEY}"]`);
}

function isVideoUrl(value = "") {
  return /\.(mp4|webm)(?:$|\?)/i.test(value);
}

function enhanceCard() {
  const card = getHeroCard();
  if (!card || card.dataset.heroMediaEnhanced === "true") return;

  const input = card.querySelector('input[data-action="upload"]');
  if (input) {
    input.accept = ACCEPTED_MEDIA;
    const label = input.closest("label");
    if (label) {
      const icon = label.querySelector("i");
      Array.from(label.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) node.remove();
      });
      label.append(document.createTextNode(" Schimbă imaginea / video"));
      if (icon && icon.nextSibling !== label.lastChild) label.insertBefore(icon, label.lastChild);
    }
  }

  const meta = card.querySelector(".site-editor-image-meta");
  const img = card.querySelector(".site-editor-image-preview img");
  const value = meta?.textContent?.trim() || "";

  if (img && isVideoUrl(value)) {
    const video = document.createElement("video");
    video.src = value;
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
    img.replaceWith(video);
  }

  card.dataset.heroMediaEnhanced = "true";
}

const editorContent = document.querySelector("#site-editor-content");
if (editorContent) {
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceCard();
    });
  });
  observer.observe(editorContent, { childList: true, subtree: true });
}

queueMicrotask(enhanceCard);

document.addEventListener("change", async event => {
  const input = event.target.closest(`[data-field-key="${HERO_KEY}"] input[data-action="upload"]`);
  if (!input) return;

  const file = input.files?.[0];
  if (!file || !file.type.startsWith("video/")) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (!["video/mp4", "video/webm"].includes(file.type)) {
    alert("Pentru fundal video folosește MP4 sau WebM.");
    input.value = "";
    return;
  }
  if (file.size > MAX_VIDEO) {
    alert("Videoclipul este prea mare. Limita este 150 MB.");
    input.value = "";
    return;
  }

  const card = getHeroCard();
  card?.classList.add("site-editor-saving");
  input.disabled = true;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) throw new Error("Sesiunea a expirat.");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,is_active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.is_active || profile.role !== "admin") {
      throw new Error("Doar administratorul poate modifica fundalul site-ului.");
    }

    const ext = file.type === "video/webm" ? "webm" : "mp4";
    const storagePath = `home/home-hero-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("site-content")
      .upload(storagePath, file, { cacheControl: "3600", upsert: false, contentType: file.type });

    if (uploadError) throw new Error(`Video-ul nu a putut fi încărcat: ${uploadError.message}`);

    const publicUrl = supabase.storage.from("site-content").getPublicUrl(storagePath).data.publicUrl;
    const { error: rowError } = await supabase.from("site_content").upsert({
      content_key: HERO_KEY,
      page_key: "home",
      content_type: "video",
      value: publicUrl,
      updated_by: user.id
    }, { onConflict: "content_key" });

    if (rowError) {
      await supabase.storage.from("site-content").remove([storagePath]);
      throw new Error(`Video-ul a fost încărcat, dar nu a putut fi publicat: ${rowError.message}`);
    }

    alert("Fundalul video a fost publicat pe pagina Acasă.");
    window.location.reload();
  } catch (error) {
    console.error("Site Editor hero video:", error);
    alert(error?.message || "A apărut o eroare la publicarea videoclipului.");
  } finally {
    card?.classList.remove("site-editor-saving");
    input.disabled = false;
    input.value = "";
  }
}, true);
