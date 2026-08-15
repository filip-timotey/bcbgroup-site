import { supabase } from "./supabase-client.js";

const HERO_KEY = "home.hero.background";
const FALLBACK_IMAGE = "assets/images/bg.site.home.png";

function ensureStyles(){
  if(document.querySelector("#bcb-home-hero-media-styles")) return;
  const style=document.createElement("style");
  style.id="bcb-home-hero-media-styles";
  style.textContent=`
    .bcb26-hero-bg{
      overflow:hidden;
      background-color:#f8f5ef;
      background-size:cover!important;
      background-position:center!important;
      background-repeat:no-repeat!important;
    }
    .bcb26-hero-bg-media{
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      min-width:100%;
      min-height:100%;
      object-fit:cover;
      object-position:center center;
      z-index:-1;
      display:block;
      pointer-events:none;
    }
    .bcb26-hero-bg.is-video{background-image:none!important}
    .bcb26-hero-bg.is-video::after{z-index:1;pointer-events:none}

    /* One published Hero source is used on desktop, tablet and mobile. */
    @media (max-width:1100px){
      .bcb26-hero-bg-media{object-fit:cover;object-position:center center}
      .bcb26-hero-bg{background-size:cover!important;background-position:center!important}
    }
    @media (max-width:700px){
      .bcb26-hero-bg-media{object-fit:cover;object-position:center center}
      .bcb26-hero-bg{background-size:cover!important;background-position:center!important}
    }
    @media (prefers-reduced-motion:reduce){
      .bcb26-hero-bg-media{display:none!important}
      .bcb26-hero-bg.is-video{
        background-image:url("${FALLBACK_IMAGE}")!important;
        background-size:cover!important;
        background-position:center!important;
      }
    }
  `;
  document.head.appendChild(style);
}

function looksLikeVideo(value="", contentType=""){
  return contentType === "video" || /\.(mp4|webm)(?:$|\?)/i.test(value);
}

function clearPreviousMedia(root){
  root.querySelector(".bcb26-hero-bg-media")?.remove();
  root.classList.remove("is-video");
  root.style.removeProperty("background-image");
}

async function applyHeroMedia(){
  const root=document.querySelector(".bcb26-hero-bg");
  if(!root) return;

  ensureStyles();

  const {data,error}=await supabase
    .from("site_content")
    .select("value,content_type")
    .eq("content_key",HERO_KEY)
    .maybeSingle();

  if(error){
    console.error("BCB Hero media could not be loaded:",error);
    return;
  }
  if(!data?.value) return;

  clearPreviousMedia(root);

  if(looksLikeVideo(data.value,data.content_type)){
    root.classList.add("is-video");
    root.style.setProperty("background-image","none","important");

    const video=document.createElement("video");
    video.className="bcb26-hero-bg-media";
    video.src=data.value;
    video.autoplay=true;
    video.muted=true;
    video.defaultMuted=true;
    video.loop=true;
    video.playsInline=true;
    video.preload="metadata";
    video.setAttribute("muted","");
    video.setAttribute("autoplay","");
    video.setAttribute("loop","");
    video.setAttribute("playsinline","");
    video.setAttribute("webkit-playsinline","");
    video.setAttribute("aria-hidden","true");
    video.setAttribute("tabindex","-1");

    root.prepend(video);
    video.play().catch(()=>{});
    return;
  }

  const safeUrl=String(data.value).replaceAll('"','%22');
  root.style.setProperty("background-image",`url("${safeUrl}")`,"important");
  root.style.setProperty("background-size","cover","important");
  root.style.setProperty("background-position","center","important");
}

if(document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded",applyHeroMedia,{once:true});
} else {
  applyHeroMedia();
}
