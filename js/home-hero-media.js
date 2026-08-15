import { supabase } from "./supabase-client.js";

const HERO_KEY = "home.hero.background";

function ensureStyles(){
  if(document.querySelector("#bcb-home-hero-media-styles")) return;
  const style=document.createElement("style");
  style.id="bcb-home-hero-media-styles";
  style.textContent=`
    .bcb26-hero-bg{overflow:hidden;background-color:#f8f5ef}
    .bcb26-hero-bg-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:0;display:block;pointer-events:none}
    .bcb26-hero-bg.is-video{background-image:none!important;background-color:#f8f5ef!important}
    .bcb26-hero-bg::after{z-index:1;pointer-events:none}
    .bcb26-hero-bg.is-video::after{z-index:1;pointer-events:none}
    @media (max-width:1100px){.bcb26-hero-bg-media{object-position:center center}}
    @media (max-width:700px){.bcb26-hero-bg-media{object-position:center center;min-width:100%;min-height:100%}}
  `;
  document.head.appendChild(style);
}

function looksLikeVideo(value="", contentType=""){
  return contentType === "video" || /\.(mp4|webm)(?:$|\?)/i.test(value);
}

function createHeroVideo(url){
  const video=document.createElement("video");
  video.className="bcb26-hero-bg-media";
  video.autoplay=true;
  video.muted=true;
  video.defaultMuted=true;
  video.loop=true;
  video.playsInline=true;
  video.preload="auto";
  video.disablePictureInPicture=true;
  video.setAttribute("autoplay","");
  video.setAttribute("muted","");
  video.setAttribute("loop","");
  video.setAttribute("playsinline","");
  video.setAttribute("webkit-playsinline","");
  video.setAttribute("aria-hidden","true");
  video.setAttribute("tabindex","-1");

  const source=document.createElement("source");
  source.src=url;
  source.type=/\.webm(?:$|\?)/i.test(url)?"video/webm":"video/mp4";
  video.appendChild(source);
  return video;
}

async function applyHeroMedia(){
  const root=document.querySelector(".bcb26-hero-bg");
  if(!root) return;
  ensureStyles();

  const {data,error}=await supabase.from("site_content").select("value,content_type").eq("content_key",HERO_KEY).maybeSingle();
  if(error){ console.error("BCB hero media load error:",error); return; }
  if(!data?.value) return;

  root.querySelector(".bcb26-hero-bg-media")?.remove();
  root.classList.remove("is-video");

  if(looksLikeVideo(data.value,data.content_type)){
    root.style.backgroundImage="none";
    root.classList.add("is-video");
    const video=createHeroVideo(data.value);
    root.prepend(video);

    const tryPlay=()=>video.play().catch(()=>{});
    video.addEventListener("loadedmetadata",tryPlay,{once:true});
    video.addEventListener("canplay",tryPlay,{once:true});
    document.addEventListener("visibilitychange",()=>{ if(!document.hidden && video.paused) tryPlay(); });
    window.addEventListener("pageshow",()=>{ if(video.paused) tryPlay(); },{passive:true});
    tryPlay();
  } else {
    root.style.backgroundImage=`url("${String(data.value).replaceAll('"','%22')}")`;
  }
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",applyHeroMedia,{once:true});
else applyHeroMedia();
