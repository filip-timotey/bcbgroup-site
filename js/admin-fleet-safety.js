import { requireStaff, supabase, esc, fmtDate } from "./admin-common.js";

const TYPE_LABELS={accident:"Accident",damage:"Avarie",breakdown:"Defecțiune",theft:"Furt",vandalism:"Vandalism",near_miss:"Incident evitat",other:"Alt incident"};
const SEVERITY_LABELS={minor:"Minor",moderate:"Moderat",major:"Major",critical:"Critic"};
const STATUS_LABELS={reported:"Raportat",under_review:"În verificare",insurance:"Asigurare",repair:"În reparație",resolved:"Rezolvat",closed:"Închis"};

let ctx=null, vehicles=[], profiles=new Map(), incidents=[], files=[];
const $=s=>document.querySelector(s);
const modal=$("#fleet-modal"), modalContent=$("#fleet-modal-content");

function showModal(html){ if(!modal||!modalContent)return; modalContent.innerHTML=html; modal.hidden=false; }
function hideModal(){ if(!modal||!modalContent)return; modal.hidden=true; modalContent.innerHTML=""; }
function vehicleName(id){const v=vehicles.find(x=>x.id===id);return v?`${v.registration_number} · ${v.make} ${v.model}`:"Vehicul";}
function personName(id){const p=profiles.get(id);return p?.full_name||p?.email||"Utilizator";}
function dtLocal(value){const d=value?new Date(value):new Date();const z=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;}
function money(v){return v==null||v===""?"—":`${Number(v).toLocaleString("ro-RO",{maximumFractionDigits:2})} lei`;}

function injectUi(){
  if($("[data-fleet-tab='incidents']"))return;
  const tabs=$(".fleet-tabs");
  const settings=$("[data-fleet-tab='settings']");
  const btn=document.createElement("button");
  btn.dataset.fleetTab="incidents";
  btn.innerHTML='<i class="fa-solid fa-triangle-exclamation"></i> Incidente';
  tabs?.insertBefore(btn,settings||null);

  const panel=document.createElement("section");
  panel.className="fleet-panel";
  panel.dataset.fleetPanel="incidents";
  panel.innerHTML=`
    <div class="fleet-section-head"><div><span>Siguranță & conformitate</span><h3>Incidente și accidente</h3></div><button id="fleet-add-incident" class="fleet-admin-action"><i class="fa-solid fa-plus"></i> Raportează incident</button></div>
    <div class="fleet-incident-summary" id="fleet-incident-summary"></div>
    <div class="fleet-filters"><input id="fleet-incident-search" placeholder="Caută vehicul, locație, șofer..."><select id="fleet-incident-status"><option value="">Toate statusurile</option>${Object.entries(STATUS_LABELS).map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select></div>
    <div id="fleet-incidents-list" class="fleet-incidents-list"></div>`;
  $(".bcb-admin-main")?.appendChild(panel);

  btn.addEventListener("click",()=>{
    document.querySelectorAll("[data-fleet-tab]").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll("[data-fleet-panel]").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active"); panel.classList.add("active");
  });
  $("#fleet-add-incident")?.addEventListener("click",openIncidentForm);
  $("#fleet-incident-search")?.addEventListener("input",renderIncidents);
  $("#fleet-incident-status")?.addEventListener("change",renderIncidents);
}

async function loadData(){
  const [v,p,i,f]=await Promise.all([
    supabase.from("fleet_vehicles").select("id,registration_number,make,model,is_active").order("registration_number"),
    supabase.from("profiles").select("id,full_name,email"),
    supabase.from("fleet_incidents").select("*").order("occurred_at",{ascending:false}),
    supabase.from("fleet_incident_files").select("*").order("created_at")
  ]);
  if(i.error){console.error(i.error);return false;}
  vehicles=v.data||[];profiles=new Map((p.data||[]).map(x=>[x.id,x]));incidents=i.data||[];files=f.data||[];
  renderIncidents(); return true;
}

function renderIncidents(){
  const root=$("#fleet-incidents-list"), summary=$("#fleet-incident-summary"); if(!root)return;
  const term=($("#fleet-incident-search")?.value||"").trim().toLowerCase(); const status=$("#fleet-incident-status")?.value||"";
  let rows=incidents.filter(i=>!status||i.status===status);
  if(term)rows=rows.filter(i=>[vehicleName(i.vehicle_id),personName(i.driver_id),personName(i.reporter_id),i.location_text,i.description,TYPE_LABELS[i.incident_type]].join(" ").toLowerCase().includes(term));
  if(summary){
    const open=incidents.filter(i=>!["resolved","closed"].includes(i.status)).length;
    const critical=incidents.filter(i=>["major","critical"].includes(i.severity)&&!["resolved","closed"].includes(i.status)).length;
    summary.innerHTML=`<article><span>Total</span><strong>${incidents.length}</strong></article><article><span>Deschise</span><strong>${open}</strong></article><article><span>Majore / critice</span><strong>${critical}</strong></article>`;
  }
  root.innerHTML=rows.length?rows.map(i=>{
    const count=files.filter(f=>f.incident_id===i.id).length;
    return `<article class="fleet-incident-card is-${esc(i.severity)}" data-id="${i.id}"><div class="fleet-incident-main"><div class="fleet-incident-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div><span class="fleet-incident-type">${esc(TYPE_LABELS[i.incident_type]||i.incident_type)} · ${esc(SEVERITY_LABELS[i.severity]||i.severity)}</span><h4>${esc(vehicleName(i.vehicle_id))}</h4><p>${esc(i.location_text)} · ${fmtDate(i.occurred_at)}</p></div></div><div><strong>${esc(personName(i.driver_id||i.reporter_id))}</strong><span>${count} fișier${count===1?"":"e"} atașat${count===1?"":"e"}</span></div><div><span class="fleet-incident-status">${esc(STATUS_LABELS[i.status]||i.status)}</span></div><button class="fleet-admin-action fleet-open-incident" data-id="${i.id}"><i class="fa-solid fa-eye"></i> Detalii</button></article>`;
  }).join(""):'<div class="fleet-empty">Nu există incidente raportate.</div>';
  root.querySelectorAll(".fleet-open-incident").forEach(b=>b.addEventListener("click",()=>openIncidentDetail(b.dataset.id)));
}

async function openIncidentForm(){
  const activeVehicles=vehicles.filter(v=>v.is_active);
  showModal(`<h2>Raportează incident</h2><p style="color:#777;font-size:10px;margin-top:5px">Înregistrează faptele cât mai exact. Data raportării și utilizatorul sunt salvate automat.</p><form id="fleet-incident-form" class="fleet-form">
    <label>Vehicul<select name="vehicle_id" required>${activeVehicles.map(v=>`<option value="${v.id}">${esc(vehicleName(v.id))}</option>`).join("")}</select></label>
    <label>Data și ora<input name="occurred_at" type="datetime-local" value="${dtLocal()}" required></label>
    <label>Tip incident<select name="incident_type">${Object.entries(TYPE_LABELS).map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select></label>
    <label>Severitate<select name="severity"><option value="minor">Minor</option><option value="moderate">Moderat</option><option value="major">Major</option><option value="critical">Critic</option></select></label>
    <label class="wide">Locație<input name="location_text" required placeholder="Stradă, localitate, reper..."></label>
    <label class="wide">Descriere incident<textarea name="description" required placeholder="Ce s-a întâmplat, în ce condiții, ordinea evenimentelor..."></textarea></label>
    <label class="wide">Avarii observate<textarea name="damage_description" placeholder="Elemente avariate, stare vizibilă, alte observații..."></textarea></label>
    <label>Persoane rănite?<select name="injuries"><option value="false">Nu</option><option value="true">Da</option></select></label>
    <label>Terți implicați?<select name="third_parties_involved"><option value="false">Nu</option><option value="true">Da</option></select></label>
    <label class="wide">Date terți / martori<textarea name="third_party_details" placeholder="Nume, telefon, număr auto, asigurare..."></textarea></label>
    <label>Poliția anunțată?<select name="police_notified"><option value="false">Nu</option><option value="true">Da</option></select></label>
    <label>Amiabilă completată?<select name="amicable_report"><option value="false">Nu</option><option value="true">Da</option></select></label>
    <label>Mașina este deplasabilă?<select name="vehicle_drivable"><option value="true">Da</option><option value="false">Nu</option></select></label>
    <label>Referință poliție<input name="police_reference" placeholder="Proces verbal / dosar"></label>
    <label class="wide">Poze / documente<input name="evidence" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple></label>
    <div class="fleet-gps-note"><i class="fa-solid fa-location-dot"></i> Sistemul încearcă să atașeze automat coordonatele GPS ale raportării. Pentru accidente grave sau persoane rănite, procedurile legale și de urgență au prioritate față de completarea formularului.</div>
    <button type="submit"><i class="fa-solid fa-shield-halved"></i> SALVEAZĂ RAPORTUL</button>
  </form>`);
  $("#fleet-incident-form")?.addEventListener("submit",submitIncident);
}

function getPosition(){return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),()=>resolve(null),{enableHighAccuracy:true,timeout:6000,maximumAge:30000});});}

async function submitIncident(e){
  e.preventDefault(); const form=e.currentTarget, btn=form.querySelector("button[type='submit']"); btn.disabled=true; btn.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Se salvează…';
  try{
    const fd=new FormData(form), pos=await getPosition();
    const payload={vehicle_id:fd.get("vehicle_id"),reporter_id:ctx.session.user.id,driver_id:ctx.session.user.id,incident_type:fd.get("incident_type"),severity:fd.get("severity"),occurred_at:new Date(fd.get("occurred_at")).toISOString(),location_text:String(fd.get("location_text")||"").trim(),description:String(fd.get("description")||"").trim(),damage_description:String(fd.get("damage_description")||"").trim()||null,injuries:fd.get("injuries")==="true",third_parties_involved:fd.get("third_parties_involved")==="true",third_party_details:String(fd.get("third_party_details")||"").trim()||null,police_notified:fd.get("police_notified")==="true",police_reference:String(fd.get("police_reference")||"").trim()||null,amicable_report:fd.get("amicable_report")==="true",vehicle_drivable:fd.get("vehicle_drivable")==="true",latitude:pos?.lat??null,longitude:pos?.lng??null};
    const {data:incident,error}=await supabase.from("fleet_incidents").insert(payload).select().single(); if(error)throw error;
    const evidence=[...form.querySelector('[name="evidence"]')?.files||[]];
    for(const file of evidence){
      if(file.size>50*1024*1024)continue;
      const ext=(file.name.split(".").pop()||"bin").replace(/[^a-z0-9]/gi,""); const path=`${incident.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const up=await supabase.storage.from("fleet-incidents").upload(path,file,{contentType:file.type,upsert:false}); if(up.error){console.error(up.error);continue;}
      await supabase.from("fleet_incident_files").insert({incident_id:incident.id,uploaded_by:ctx.session.user.id,file_path:path,file_name:file.name,mime_type:file.type,file_size:file.size,category:file.type==="application/pdf"?"document":"photo"});
    }
    hideModal(); await loadData(); document.querySelector('[data-fleet-tab="incidents"]')?.click();
  }catch(err){console.error(err);alert(`Incidentul nu a putut fi salvat: ${err.message||err}`);}
  finally{btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-shield-halved"></i> SALVEAZĂ RAPORTUL';}
}

async function openIncidentDetail(id){
  const i=incidents.find(x=>x.id===id); if(!i)return; const incidentFiles=files.filter(f=>f.incident_id===id);
  const signed=[]; for(const f of incidentFiles){const {data}=await supabase.storage.from("fleet-incidents").createSignedUrl(f.file_path,1800);signed.push({...f,url:data?.signedUrl||""});}
  const admin=ctx.profile.role==="admin";
  showModal(`<div class="fleet-incident-detail"><span class="fleet-incident-type">${esc(TYPE_LABELS[i.incident_type])} · ${esc(SEVERITY_LABELS[i.severity])}</span><h2>${esc(vehicleName(i.vehicle_id))}</h2><p>${fmtDate(i.occurred_at)} · ${esc(i.location_text)}</p>
    <div class="fleet-incident-detail-grid"><div><span>Șofer / raportor</span><strong>${esc(personName(i.driver_id||i.reporter_id))}</strong></div><div><span>Status</span><strong>${esc(STATUS_LABELS[i.status])}</strong></div><div><span>Deplasabilă</span><strong>${i.vehicle_drivable?"Da":"Nu"}</strong></div><div><span>Persoane rănite</span><strong>${i.injuries?"Da":"Nu"}</strong></div></div>
    <h4>Descriere</h4><p>${esc(i.description)}</p>${i.damage_description?`<h4>Avarii</h4><p>${esc(i.damage_description)}</p>`:""}${i.third_party_details?`<h4>Terți / martori</h4><p>${esc(i.third_party_details)}</p>`:""}
    <div class="fleet-incident-evidence">${signed.length?signed.map(f=>f.mime_type?.startsWith("image/")?`<a href="${f.url}" target="_blank"><img src="${f.url}" alt="Dovadă incident"></a>`:`<a class="fleet-incident-file" href="${f.url}" target="_blank"><i class="fa-solid fa-file-pdf"></i>${esc(f.file_name||"Document")}</a>`).join(""):'<div class="fleet-empty">Nu sunt fișiere atașate.</div>'}</div>
    ${admin?`<form id="fleet-incident-admin-form" class="fleet-form"><h3>Control administrator</h3><label>Status<select name="status">${Object.entries(STATUS_LABELS).map(([v,l])=>`<option value="${v}" ${i.status===v?"selected":""}>${l}</option>`).join("")}</select></label><label>Cost estimat<input name="estimated_cost" type="number" step="0.01" value="${i.estimated_cost??""}"></label><label>Cost final<input name="actual_cost" type="number" step="0.01" value="${i.actual_cost??""}"></label><label>Dosar asigurare<input name="insurance_claim_number" value="${esc(i.insurance_claim_number||"")}"></label><label class="wide">Note interne<textarea name="admin_notes">${esc(i.admin_notes||"")}</textarea></label><label class="wide">Rezoluție<textarea name="resolution_notes">${esc(i.resolution_notes||"")}</textarea></label><button type="submit"><i class="fa-solid fa-floppy-disk"></i> SALVEAZĂ ACTUALIZAREA</button><button type="button" class="fleet-danger-action" id="fleet-delete-incident"><i class="fa-solid fa-trash"></i> Șterge definitiv incidentul</button></form>`:""}
  </div>`);
  if(admin){$("#fleet-incident-admin-form")?.addEventListener("submit",e=>saveAdminIncident(e,i));$("#fleet-delete-incident")?.addEventListener("click",()=>deleteIncident(i));}
}

async function saveAdminIncident(e,i){e.preventDefault();const fd=new FormData(e.currentTarget),status=fd.get("status");const payload={status,estimated_cost:fd.get("estimated_cost")?Number(fd.get("estimated_cost")):null,actual_cost:fd.get("actual_cost")?Number(fd.get("actual_cost")):null,insurance_claim_number:String(fd.get("insurance_claim_number")||"").trim()||null,admin_notes:String(fd.get("admin_notes")||"").trim()||null,resolution_notes:String(fd.get("resolution_notes")||"").trim()||null,reviewed_by:ctx.session.user.id,reviewed_at:new Date().toISOString(),resolved_at:["resolved","closed"].includes(status)?(i.resolved_at||new Date().toISOString()):null};const {error}=await supabase.from("fleet_incidents").update(payload).eq("id",i.id);if(error)return alert(error.message);hideModal();await loadData();}

async function deleteIncident(i){if(!confirm("Ștergi definitiv acest incident și toate fișierele lui? Acțiunea nu poate fi anulată."))return;const incidentFiles=files.filter(f=>f.incident_id===i.id);if(incidentFiles.length)await supabase.storage.from("fleet-incidents").remove(incidentFiles.map(f=>f.file_path));const {error}=await supabase.from("fleet_incidents").delete().eq("id",i.id);if(error)return alert(error.message);hideModal();await loadData();}

async function markBusyVehiclesInStartForm(form){
  if(form.dataset.availabilityChecked)return;form.dataset.availabilityChecked="true";
  const select=form.querySelector('[name="vehicle_id"]');if(!select)return;
  const {data,error}=await supabase.rpc("fleet_vehicle_availability");if(error){console.error(error);return;}
  const busy=new Set((data||[]).filter(x=>x.is_busy).map(x=>x.vehicle_id));
  [...select.options].forEach(o=>{if(busy.has(o.value)){o.disabled=true;o.textContent+=` · ÎN CURSĂ`;}});
  if(select.selectedOptions[0]?.disabled){const first=[...select.options].find(o=>!o.disabled);if(first)select.value=first.value;}
  if(![...select.options].some(o=>!o.disabled)){select.disabled=true;const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent="Toate vehiculele sunt în cursă";}}
}

function watchStartForm(){
  const target=$("#fleet-modal-content");if(!target)return;
  const observer=new MutationObserver(()=>{const form=$("#fleet-start-form");if(form)markBusyVehiclesInStartForm(form);});
  observer.observe(target,{childList:true,subtree:true});
}

(async function init(){
  ctx=await requireStaff(); if(!ctx)return;
  injectUi(); watchStartForm(); await loadData();
})();
