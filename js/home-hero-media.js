import { supabase } from "./supabase-client.js";

const HERO_KEY = "home.hero.background";

function ensureStyles(){
  if(document.querySelector("#bcb-home-hero-media-styles")) return;
  const style=document.createElement("style");
  style.id="bcb-home-hero-media-styles";
  style.textContent=`
    .bcb26-hero-bg{overflow:hidden;background-color:#f8f5ef}
    .bcb26-hero-bg-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:-1;display:block}
    .bcb26-hero-bg.is-video{background-image:none!important}
    .bcb26-hero-bg.is-video::after{z-index:1;pointer-events:none}
    @media (prefers-reduced-motion: reduce){.bcb26-hero-bg-media{display:none}.bcb26-hero-bg.is-video{background-image:url("../assets/images/bg.site.home.png")!important;background-size:cover;background-position:center}}
  `;
  document.head.appendChild(style);
}

function looksLikeVideo(value="", contentType=""){
  return contentType === "video" || /\.(mp4|webm)(?:$|\?)/i.test(value);
}

async function applyHeroMedia(){
  const root=document.querySelector(".bcb26-hero-bg");
  if(!root) return;
  ensureStyles();
  const {data,error}=await supabase.from("site_content").select("value,content_type").eq("content_key",HERO_KEY).maybeSingle();
  if(error || !data?.value) return;

  root.querySelector(".bcb26-hero-bg-media")?.remove();
  root.classList.remove("is-video");

  if(looksLikeVideo(data.value,data.content_type)){
    root.style.backgroundImage="none";
    root.classList.add("is-video");
    const video=document.createElement("video");
    video.className="bcb26-hero-bg-media";
    video.src=data.value;
    video.autoplay=true;
    video.muted=true;
    video.loop=true;
    video.playsInline=true;
    video.preload="metadata";
    video.setAttribute("aria-hidden","true");
    video.setAttribute("tabindex","-1");
    root.prepend(video);
    video.play().catch(()=>{});
  } else {
    root.style.backgroundImage=`url("${String(data.value).replaceAll('"','%22')}")`;
  }
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",applyHeroMedia,{once:true});
else applyHeroMedia();
