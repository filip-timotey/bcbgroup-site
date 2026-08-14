import { requireStaff, supabase, esc, fmtDate } from "./admin-common.js";

const list=document.querySelector("#activity-list");
const refresh=document.querySelector("#activity-refresh");
const icons={projects:"fa-building",project_media:"fa-images",quote_requests:"fa-file-signature",profiles:"fa-user-shield"};
const verbs={insert:"Creat",update:"Modificat",delete:"Șters"};

async function load(){
  list.innerHTML='<div class="bcb-biz-empty">Se încarcă activitatea…</div>';
  const {data,error}=await supabase.from("activity_log").select("id,actor_id,action,entity_type,entity_id,summary,created_at").order("created_at",{ascending:false}).limit(200);
  if(error){ console.error(error); list.innerHTML='<div class="bcb-biz-empty">Jurnalul de activitate așteaptă activarea schemei Supabase.</div>'; return; }
  const rows=data||[];
  const actorIds=[...new Set(rows.map(r=>r.actor_id).filter(Boolean))];
  let names=new Map();
  if(actorIds.length){ const {data:profiles}=await supabase.from("profiles").select("id,full_name").in("id",actorIds); names=new Map((profiles||[]).map(p=>[p.id,p.full_name])); }
  if(!rows.length){ list.innerHTML='<div class="bcb-biz-empty">Nu există încă activitate înregistrată.</div>'; return; }
  list.innerHTML=rows.map(r=>`<article class="bcb-activity-item"><div class="bcb-activity-icon"><i class="fa-solid ${icons[r.entity_type]||"fa-circle-dot"}"></i></div><div><strong>${esc(verbs[r.action]||r.action)} · ${esc(r.summary||r.entity_type)}</strong><p>${esc(names.get(r.actor_id)|| (r.actor_id?"Utilizator BCB":"Website / sistem"))} · ${esc(r.entity_type)}</p></div><time>${esc(fmtDate(r.created_at))}</time></article>`).join("");
}

refresh?.addEventListener("click",load);
(async()=>{ if(await requireStaff()) await load(); })();
