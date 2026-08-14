import { requireStaff, supabase, esc } from "./admin-common.js";

const library = document.querySelector("#media-library");
const search = document.querySelector("#media-search");
const projectFilter = document.querySelector("#media-project-filter");
let items = [];
let projects = new Map();

function publicUrl(path){ return supabase.storage.from("project-media").getPublicUrl(path).data.publicUrl; }

function render(){
  const term=(search?.value||"").trim().toLowerCase();
  const projectId=projectFilter?.value||"all";
  const filtered=items.filter(item=>{
    const projectName=projects.get(item.project_id)?.title||"";
    const hay=[item.title,projectName,item.media_type].filter(Boolean).join(" ").toLowerCase();
    return (!term||hay.includes(term)) && (projectId==="all"||item.project_id===projectId);
  });
  if(!filtered.length){ library.innerHTML='<div class="bcb-biz-empty">Nu există fișiere pentru filtrul selectat.</div>'; return; }
  library.innerHTML=filtered.map(item=>{
    const url=publicUrl(item.storage_path);
    const project=projects.get(item.project_id);
    const preview=item.media_type==="video"?`<video src="${esc(url)}" controls muted preload="metadata"></video>`:`<img src="${esc(url)}" alt="Media BCB" loading="lazy">`;
    return `<article>${preview}<footer><strong>${esc(project?.title||"Proiect")}</strong><span>${esc(item.title||item.media_type)}</span><div class="bcb-biz-card-actions"><a href="project.html?id=${encodeURIComponent(item.project_id)}"><i class="fa-solid fa-pen"></i> Deschide proiectul</a></div></footer></article>`;
  }).join("");
}

async function load(){
  const [{data:projectRows,error:projectError},{data:mediaRows,error:mediaError}]=await Promise.all([
    supabase.from("projects").select("id,title").order("title"),
    supabase.from("project_media").select("id,project_id,media_type,storage_path,title,created_at").order("created_at",{ascending:false})
  ]);
  if(projectError||mediaError){ console.error(projectError||mediaError); library.innerHTML='<div class="bcb-biz-empty">Nu am putut încărca biblioteca media.</div>'; return; }
  projects=new Map((projectRows||[]).map(p=>[p.id,p]));
  items=mediaRows||[];
  projectFilter.innerHTML='<option value="all">Toate proiectele</option>'+[...projects.values()].map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join("");
  render();
}

search?.addEventListener("input",render);
projectFilter?.addEventListener("change",render);
(async()=>{ if(await requireStaff()) await load(); })();
