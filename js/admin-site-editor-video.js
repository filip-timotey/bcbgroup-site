import { supabase } from "./supabase-client.js";

const HERO_KEY="home.hero.background";
const MAX_VIDEO=150*1024*1024;

function getHeroCard(){ return document.querySelector(`[data-field-key="${HERO_KEY}"]`); }

function enhanceCard(){
  const card=getHeroCard();
  if(!card) return;
  const input=card.querySelector(`input[data-action="upload"]`);
  if(input){
    input.accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm";
    const label=input.closest("label");
    if(label) label.innerHTML='<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" data-action="upload"><i class="fa-solid fa-cloud-arrow-up"></i> Schimbă imaginea / video';
  }
  const meta=card.querySelector(".site-editor-image-meta");
  const img=card.querySelector(".site-editor-image-preview img");
  const value=meta?.textContent?.trim()||"";
  if(img && /\.(mp4|webm)(?:$|\?)/i.test(value)){
    const video=document.createElement("video");
    video.src=value;
    video.controls=true;
    video.muted=true;
    video.loop=true;
    video.playsInline=true;
    video.preload="metadata";
    video.style.cssText="width:100%;height:100%;object-fit:cover;display:block";
    img.replaceWith(video);
  }
}

const observer=new MutationObserver(()=>enhanceCard());
observer.observe(document.documentElement,{childList:true,subtree:true});
queueMicrotask(enhanceCard);

document.addEventListener("change",async(event)=>{
  const input=event.target.closest(`[data-field-key="${HERO_KEY}"] input[data-action="upload"]`);
  if(!input) return;
  const file=input.files?.[0];
  if(!file || !file.type.startsWith("video/")) return; // images continue through the existing editor
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if(!["video/mp4","video/webm"].includes(file.type)) return alert("Pentru fundal video folosește MP4 sau WebM.");
  if(file.size>MAX_VIDEO) return alert("Videoclipul este prea mare. Limita este 150 MB.");

  const {data:sessionData}=await supabase.auth.getSession();
  const user=sessionData.session?.user;
  if(!user) return alert("Sesiunea a expirat.");
  const {data:profile}=await supabase.from("profiles").select("role,is_active").eq("id",user.id).single();
  if(!profile?.is_active || profile.role!=="admin") return alert("Doar administratorul poate modifica fundalul site-ului.");

  const card=getHeroCard();
  card?.classList.add("site-editor-saving");
  const ext=file.type==="video/webm"?"webm":"mp4";
  const storagePath=`home/home-hero-${Date.now()}.${ext}`;
  const {error:uploadError}=await supabase.storage.from("site-content").upload(storagePath,file,{cacheControl:"3600",upsert:false,contentType:file.type});
  if(uploadError){ card?.classList.remove("site-editor-saving"); return alert(`Video-ul nu a putut fi încărcat: ${uploadError.message}`); }

  const publicUrl=supabase.storage.from("site-content").getPublicUrl(storagePath).data.publicUrl;
  const {error:rowError}=await supabase.from("site_content").upsert({content_key:HERO_KEY,page_key:"home",content_type:"video",value:publicUrl,updated_by:user.id},{onConflict:"content_key"});
  card?.classList.remove("site-editor-saving");
  if(rowError){ await supabase.storage.from("site-content").remove([storagePath]); return alert(`Video-ul a fost încărcat, dar nu a putut fi publicat: ${rowError.message}`); }
  alert("Fundalul video a fost publicat pe pagina Acasă.");
  window.location.reload();
},true);
