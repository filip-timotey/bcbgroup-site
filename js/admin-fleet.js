import { requireStaff, supabase, esc, fmtDate } from "./admin-common.js";

let ctx = null;
let vehicles = [];
let trips = [];
let profiles = new Map();
let documents = [];
let fuelEntries = [];
let reports = [];
let settings = null;

const $ = (s) => document.querySelector(s);
const modal = $("#fleet-modal");
const modalContent = $("#fleet-modal-content");

function showModal(html){ modalContent.innerHTML = html; modal.hidden = false; }
function hideModal(){ modal.hidden = true; modalContent.innerHTML = ""; }
$("#fleet-modal-close")?.addEventListener("click", hideModal);
modal?.addEventListener("click", e => { if(e.target === modal) hideModal(); });

document.querySelectorAll("[data-fleet-tab]").forEach(btn => btn.addEventListener("click",()=>{
  document.querySelectorAll("[data-fleet-tab]").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll("[data-fleet-panel]").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");
  document.querySelector(`[data-fleet-panel="${btn.dataset.fleetTab}"]`)?.classList.add("active");
}));

function monthRange(value){
  const d = value ? new Date(`${value}-01T00:00:00`) : new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth()+1, 1);
  return [start.toISOString(),end.toISOString()];
}
function km(v){ return `${Number(v||0).toLocaleString("ro-RO",{maximumFractionDigits:1})} km`; }
function vehicleName(id){ const v=vehicles.find(x=>x.id===id); return v ? `${v.make} ${v.model} · ${v.registration_number}` : "Vehicul"; }
function driverName(id){ return profiles.get(id)?.full_name || profiles.get(id)?.email || "Șofer"; }
function getPosition(){
  return new Promise(resolve=>{
    if(!navigator.geolocation){ resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),
      ()=>resolve(null),
      {enableHighAccuracy:true,timeout:8000,maximumAge:30000}
    );
  });
}

async function loadAll(){
  const now = new Date();
  const [mStart,mEnd] = monthRange(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
  const [vRes,tRes,dRes,fRes,rRes,sRes,pRes] = await Promise.all([
    supabase.from("fleet_vehicles").select("*").order("registration_number"),
    supabase.from("fleet_trips").select("*").gte("start_at",new Date(now.getFullYear()-1,0,1).toISOString()).order("start_at",{ascending:false}),
    supabase.from("fleet_documents").select("*").order("expires_at"),
    supabase.from("fleet_fuel_entries").select("*").order("fueled_at",{ascending:false}).limit(200),
    supabase.from("fleet_reports").select("*").order("report_year",{ascending:false}).order("report_month",{ascending:false}),
    supabase.from("fleet_settings").select("*").eq("id",true).maybeSingle(),
    supabase.from("profiles").select("id,full_name,email,role,is_active")
  ]);
  const firstError=[vRes,tRes,dRes,fRes,rRes].find(x=>x.error)?.error;
  if(firstError){ console.error(firstError); alert("Fleet Management nu este încă activat în baza de date. Rulează migrarea Fleet din SQL Editor."); return; }
  vehicles=vRes.data||[]; trips=tRes.data||[]; documents=dRes.data||[]; fuelEntries=fRes.data||[]; reports=rRes.data||[]; settings=sRes.data||null;
  profiles=new Map((pRes.data||[]).map(p=>[p.id,p]));
  renderAll(mStart,mEnd);
}

function renderAll(mStart,mEnd){
  const monthTrips=trips.filter(t=>t.start_at>=mStart && t.start_at<mEnd && t.status==="completed");
  $("#fleet-stat-vehicles").textContent=vehicles.filter(v=>v.is_active).length;
  $("#fleet-stat-trips").textContent=monthTrips.length;
  $("#fleet-stat-km").textContent=km(monthTrips.reduce((a,t)=>a+Number(t.distance_km||0),0));
  const soon=Date.now()+30*86400000;
  $("#fleet-stat-alerts").textContent=documents.filter(d=>d.expires_at && new Date(d.expires_at).getTime()<=soon && new Date(d.expires_at).getTime()>=Date.now()).length;
  renderActive(); renderMyTrips(); renderVehicles(); renderTrips(); renderReports(); renderDocuments(); renderFuel(); renderSettings();
}

function renderActive(){
  const active=trips.find(t=>t.driver_id===ctx.session.user.id && t.status==="active");
  const root=$("#fleet-active-trip");
  if(!active){ root.innerHTML='<div class="fleet-empty">Nu ai nicio cursă activă. Apasă START când pleci cu o mașină a firmei.</div>'; return; }
  root.innerHTML=`<article class="fleet-active-card"><div><span class="live">Cursă în desfășurare</span><h3>${esc(vehicleName(active.vehicle_id))}</h3><p>${esc(active.origin||"Plecare")}${active.destination?` → ${esc(active.destination)}`:""} · ${esc(active.purpose)}</p><p>Start: ${fmtDate(active.start_at)} · ${km(active.start_odometer)}</p></div><button class="fleet-stop-btn" id="fleet-stop-active"><i class="fa-solid fa-stop"></i> STOP CURSĂ</button></article>`;
  $("#fleet-stop-active")?.addEventListener("click",()=>openStopTrip(active));
}

function renderMyTrips(){
  const rows=trips.filter(t=>t.driver_id===ctx.session.user.id).slice(0,8);
  $("#fleet-my-trips").innerHTML=rows.length?rows.map(t=>`<article class="fleet-trip-card"><div><strong>${esc(vehicleName(t.vehicle_id))}</strong><span>${esc(t.origin||"—")} → ${esc(t.destination||"—")}</span></div><div><strong>${esc(t.purpose)}</strong><span>${fmtDate(t.start_at)}</span></div><span class="fleet-km">${t.status==="active"?"LIVE":km(t.distance_km)}</span></article>`).join(""):'<div class="fleet-empty">Nu există curse înregistrate.</div>';
}

function renderVehicles(){
  $("#fleet-vehicles-grid").innerHTML=vehicles.length?vehicles.map(v=>`<article class="fleet-vehicle"><div class="fleet-vehicle-top"><i class="fa-solid fa-car-side"></i><span class="fleet-status ${v.is_active?'':'off'}">${v.is_active?'Activ':'Inactiv'}</span></div><span class="fleet-plate">${esc(v.registration_number)}</span><h4>${esc(v.make)} ${esc(v.model)}</h4><div class="fleet-vehicle-meta"><div><span>Combustibil</span><strong>${esc(v.fuel_type)}</strong></div><div><span>Kilometraj</span><strong>${km(v.current_odometer)}</strong></div><div><span>An</span><strong>${esc(v.year||'—')}</strong></div><div><span>Cod intern</span><strong>${esc(v.internal_code||'—')}</strong></div></div>${ctx.profile.role==='admin'?`<button class="fleet-admin-action fleet-edit-vehicle" data-id="${v.id}" style="margin-top:13px"><i class="fa-solid fa-pen"></i> Editează</button>`:''}</article>`).join(""):'<div class="fleet-empty">Nu există vehicule.</div>';
  document.querySelectorAll(".fleet-edit-vehicle").forEach(b=>b.addEventListener("click",()=>openVehicleForm(vehicles.find(v=>v.id===b.dataset.id))));
}

function filteredTrips(){
  const term=($("#fleet-trip-search")?.value||"").toLowerCase().trim();
  const month=$("#fleet-trip-month")?.value;
  let rows=[...trips];
  if(ctx.profile.role!=="admin") rows=rows.filter(t=>t.driver_id===ctx.session.user.id);
  if(month){ const [s,e]=monthRange(month); rows=rows.filter(t=>t.start_at>=s&&t.start_at<e); }
  if(term) rows=rows.filter(t=>[vehicleName(t.vehicle_id),driverName(t.driver_id),t.origin,t.destination,t.purpose].join(" ").toLowerCase().includes(term));
  return rows;
}
function renderTrips(){
  const rows=filteredTrips();
  $("#fleet-all-trips").innerHTML=rows.length?`<table class="fleet-table"><thead><tr><th>Data</th><th>Vehicul</th><th>Șofer</th><th>Plecare</th><th>Destinație</th><th>Scop</th><th>Km</th><th>Status</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${fmtDate(t.start_at)}</td><td><strong>${esc(vehicleName(t.vehicle_id))}</strong></td><td>${esc(driverName(t.driver_id))}</td><td>${esc(t.origin||'—')}</td><td>${esc(t.destination||'—')}</td><td>${esc(t.purpose)}</td><td><strong>${t.status==='active'?'LIVE':km(t.distance_km)}</strong></td><td>${esc(t.status)}</td></tr>`).join("")}</tbody></table>`:'<div class="fleet-empty">Nu există curse pentru filtrul ales.</div>';
}
$("#fleet-trip-search")?.addEventListener("input",renderTrips); $("#fleet-trip-month")?.addEventListener("change",renderTrips);

function renderReports(){
  let rows=[...reports]; if(ctx.profile.role!=="admin") rows=rows.filter(r=>r.driver_id===ctx.session.user.id);
  $("#fleet-reports-list").innerHTML=rows.length?rows.map(r=>`<article class="fleet-report-card"><div><strong>${esc(r.report_number)} · ${esc(vehicleName(r.vehicle_id))}</strong><span>${String(r.report_month).padStart(2,'0')}/${r.report_year}${r.driver_id?` · ${esc(driverName(r.driver_id))}`:''}</span></div><div><strong>${r.total_trips} curse · ${km(r.total_km)}</strong><span>${Number(r.total_fuel_liters||0).toLocaleString('ro-RO')} L alimentați</span></div><div>${r.status==='generated'||r.status==='emailed'?`<button class="fleet-admin-action fleet-report-actions" data-id="${r.id}"><i class="fa-solid fa-share-nodes"></i> Deschide</button>`:`<span>${esc(r.status)}</span>`}</div></article>`).join(""):'<div class="fleet-empty">Nu există încă foi de parcurs generate.</div>';
}

function renderDocuments(){
  $("#fleet-documents-list").innerHTML=documents.length?documents.map(d=>{const days=d.expires_at?Math.ceil((new Date(d.expires_at)-Date.now())/86400000):null;return`<article class="fleet-doc-card"><div><strong>${esc(d.document_type.toUpperCase())} · ${esc(vehicleName(d.vehicle_id))}</strong><span>${esc(d.document_number||'Fără număr')}</span></div><div><strong>${d.expires_at?new Intl.DateTimeFormat('ro-RO').format(new Date(d.expires_at)): 'Fără expirare'}</strong><span>${days!=null?(days<0?'Expirat':`${days} zile rămase`):'—'}</span></div><span class="fleet-status ${days!=null&&days<30?'off':''}">${days!=null&&days<0?'EXPIRAT':days!=null&&days<=30?'ATENȚIE':'OK'}</span></article>`}).join(""):'<div class="fleet-empty">Nu există documente.</div>';
}

function renderFuel(){
  let rows=[...fuelEntries]; if(ctx.profile.role!=="admin") rows=rows.filter(f=>f.driver_id===ctx.session.user.id);
  $("#fleet-fuel-list").innerHTML=rows.length?`<table class="fleet-table"><thead><tr><th>Data</th><th>Vehicul</th><th>Șofer</th><th>Litri</th><th>Valoare</th><th>Km</th><th>Stație</th></tr></thead><tbody>${rows.map(f=>`<tr><td>${fmtDate(f.fueled_at)}</td><td>${esc(vehicleName(f.vehicle_id))}</td><td>${esc(driverName(f.driver_id))}</td><td><strong>${Number(f.liters).toLocaleString('ro-RO')} L</strong></td><td>${f.total_amount!=null?`${Number(f.total_amount).toLocaleString('ro-RO')} lei`:'—'}</td><td>${f.odometer!=null?km(f.odometer):'—'}</td><td>${esc(f.station||'—')}</td></tr>`).join('')}</tbody></table>`:'<div class="fleet-empty">Nu există alimentări.</div>';
}
function renderSettings(){ if(!settings)return; $("#fleet-report-email").value=settings.report_email||""; $("#fleet-report-cc").value=settings.report_cc||""; $("#fleet-auto-generate").checked=!!settings.auto_generate; $("#fleet-auto-email").checked=!!settings.auto_email; $("#fleet-approved-by").value=settings.approved_by||""; }

async function openStartTrip(){
  const active=trips.find(t=>t.driver_id===ctx.session.user.id&&t.status==='active'); if(active){ document.querySelector('[data-fleet-tab="today"]')?.click(); return; }
  const v=vehicles.filter(x=>x.is_active);
  showModal(`<h2>Start cursă</h2><p style="color:#777;font-size:10px;margin-top:5px">Înregistrează plecarea. Ora și utilizatorul sunt preluate automat.</p><form id="fleet-start-form" class="fleet-form"><label>Vehicul<select name="vehicle_id" required>${v.map(x=>`<option value="${x.id}">${esc(x.registration_number)} · ${esc(x.make)} ${esc(x.model)}</option>`).join('')}</select></label><label>Kilometraj plecare<input name="start_odometer" type="number" step="0.1" required></label><label>Plecare<input name="origin" required placeholder="Sediu / Oradea / șantier..."></label><label>Destinație<input name="destination" placeholder="Destinația planificată"></label><label class="wide">Scop deplasare<input name="purpose" required placeholder="Deplasare la șantier / materiale / client..."></label><label class="wide">Proiect<select name="project_id"><option value="">Fără proiect asociat</option></select></label><div class="fleet-gps-note"><i class="fa-solid fa-location-dot"></i> La START încercăm să salvăm și poziția GPS a plecării. Kilometrajul din bord rămâne valoarea oficială pentru foaia de parcurs.</div><button type="submit"><i class="fa-solid fa-play"></i> PORNEȘTE CURSA</button></form>`);
  const select=modalContent.querySelector('[name="vehicle_id"]'); const odo=modalContent.querySelector('[name="start_odometer"]');
  const syncOdo=()=>{odo.value=vehicles.find(x=>x.id===select.value)?.current_odometer||0}; syncOdo(); select.addEventListener('change',syncOdo);
  const {data:projects}=await supabase.from('projects').select('id,title').order('title'); const ps=modalContent.querySelector('[name="project_id"]'); if(ps) ps.innerHTML+=""+(projects||[]).map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join('');
  $("#fleet-start-form")?.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const pos=await getPosition();const payload={vehicle_id:fd.get('vehicle_id'),driver_id:ctx.session.user.id,project_id:fd.get('project_id')||null,start_odometer:Number(fd.get('start_odometer')),origin:String(fd.get('origin')||'').trim(),destination:String(fd.get('destination')||'').trim()||null,purpose:String(fd.get('purpose')||'').trim(),start_lat:pos?.lat||null,start_lng:pos?.lng||null,status:'active'};const {error}=await supabase.from('fleet_trips').insert(payload);if(error){alert(error.message);return;}hideModal();await loadAll();});
}
$("#fleet-start-main")?.addEventListener("click",openStartTrip);

function openStopTrip(active){
  showModal(`<h2>Încheie cursa</h2><p style="color:#777;font-size:10px;margin-top:5px">${esc(vehicleName(active.vehicle_id))} · Start ${km(active.start_odometer)}</p><form id="fleet-stop-form" class="fleet-form"><label>Kilometraj sosire<input name="end_odometer" type="number" step="0.1" min="${active.start_odometer}" required autofocus></label><label>Destinație finală<input name="destination" value="${esc(active.destination||'')}"></label><label class="wide">Observații<textarea name="notes" placeholder="Opțional"></textarea></label><div class="fleet-gps-note"><i class="fa-solid fa-location-dot"></i> Salvăm și poziția GPS la sosire dacă ai permis accesul la locație.</div><button type="submit"><i class="fa-solid fa-stop"></i> ÎNCHEIE CURSA</button></form>`);
  $("#fleet-stop-form")?.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const end=Number(fd.get('end_odometer'));if(end<Number(active.start_odometer)){alert('Kilometrajul final nu poate fi mai mic decât cel de plecare.');return;}const pos=await getPosition();const {error}=await supabase.from('fleet_trips').update({end_odometer:end,end_at:new Date().toISOString(),destination:String(fd.get('destination')||'').trim()||active.destination,notes:String(fd.get('notes')||'').trim()||null,end_lat:pos?.lat||null,end_lng:pos?.lng||null,status:'completed'}).eq('id',active.id);if(error){alert(error.message);return;}hideModal();await loadAll();});
}

function openVehicleForm(v=null){
  showModal(`<h2>${v?'Editează vehicul':'Adaugă vehicul'}</h2><form id="fleet-vehicle-form" class="fleet-form"><label>Nr. înmatriculare<input name="registration_number" value="${esc(v?.registration_number||'')}" required></label><label>Cod intern<input name="internal_code" value="${esc(v?.internal_code||'')}"></label><label>Marcă<input name="make" value="${esc(v?.make||'')}" required></label><label>Model<input name="model" value="${esc(v?.model||'')}" required></label><label>An<input name="year" type="number" value="${esc(v?.year||'')}"></label><label>Combustibil<select name="fuel_type">${['diesel','benzina','gpl','hibrid','electric','altul'].map(x=>`<option ${v?.fuel_type===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Kilometraj curent<input name="current_odometer" type="number" step="0.1" value="${esc(v?.current_odometer||0)}" required></label><label>VIN<input name="vin" value="${esc(v?.vin||'')}"></label><label class="wide">Observații<textarea name="notes">${esc(v?.notes||'')}</textarea></label><label><span>Vehicul activ</span><input name="is_active" type="checkbox" ${v?.is_active!==false?'checked':''}></label><button type="submit">SALVEAZĂ VEHICULUL</button></form>`);
  $("#fleet-vehicle-form")?.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const payload={registration_number:String(fd.get('registration_number')).trim().toUpperCase(),internal_code:String(fd.get('internal_code')||'').trim()||null,make:String(fd.get('make')).trim(),model:String(fd.get('model')).trim(),year:fd.get('year')?Number(fd.get('year')):null,fuel_type:fd.get('fuel_type'),current_odometer:Number(fd.get('current_odometer')),vin:String(fd.get('vin')||'').trim()||null,notes:String(fd.get('notes')||'').trim()||null,is_active:fd.get('is_active')==='on'};const q=v?supabase.from('fleet_vehicles').update(payload).eq('id',v.id):supabase.from('fleet_vehicles').insert(payload);const {error}=await q;if(error){alert(error.message);return;}hideModal();await loadAll();});
}
$("#fleet-add-vehicle")?.addEventListener('click',()=>openVehicleForm());

function openFuelForm(){
  showModal(`<h2>Adaugă alimentare</h2><form id="fleet-fuel-form" class="fleet-form"><label>Vehicul<select name="vehicle_id" required>${vehicles.filter(v=>v.is_active).map(v=>`<option value="${v.id}">${esc(v.registration_number)} · ${esc(v.make)} ${esc(v.model)}</option>`).join('')}</select></label><label>Litri<input name="liters" type="number" step="0.01" required></label><label>Valoare totală (lei)<input name="total_amount" type="number" step="0.01"></label><label>Kilometraj<input name="odometer" type="number" step="0.1"></label><label>Stație<input name="station"></label><label class="wide">Observații<textarea name="notes"></textarea></label><button type="submit">SALVEAZĂ ALIMENTAREA</button></form>`);
  $("#fleet-fuel-form")?.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const payload={vehicle_id:fd.get('vehicle_id'),driver_id:ctx.session.user.id,liters:Number(fd.get('liters')),total_amount:fd.get('total_amount')?Number(fd.get('total_amount')):null,odometer:fd.get('odometer')?Number(fd.get('odometer')):null,station:String(fd.get('station')||'').trim()||null,notes:String(fd.get('notes')||'').trim()||null};const {error}=await supabase.from('fleet_fuel_entries').insert(payload);if(error){alert(error.message);return;}hideModal();await loadAll();});
}
$("#fleet-add-fuel")?.addEventListener('click',openFuelForm);

$("#fleet-settings-form")?.addEventListener('submit',async e=>{e.preventDefault();if(ctx.profile.role!=='admin')return;const payload={id:true,report_email:$("#fleet-report-email").value.trim()||null,report_cc:$("#fleet-report-cc").value.trim()||null,auto_generate:$("#fleet-auto-generate").checked,auto_email:$("#fleet-auto-email").checked,approved_by:$("#fleet-approved-by").value.trim()||null};const {error}=await supabase.from('fleet_settings').upsert(payload);if(error){alert(error.message);return;}alert('Setările Fleet au fost salvate.');await loadAll();});

$("#fleet-generate-report")?.addEventListener('click',async()=>{ if(ctx.profile.role!=='admin')return; const now=new Date(); const prev=new Date(now.getFullYear(),now.getMonth()-1,1); const year=prompt('An raport',String(prev.getFullYear())); if(!year)return; const month=prompt('Lună raport (1-12)',String(prev.getMonth()+1)); if(!month)return; const {data,error}=await supabase.functions.invoke('generate-fleet-reports',{body:{year:Number(year),month:Number(month),send_email:false}}); if(error){alert('Funcția de generare nu este încă activată: '+error.message);return;} alert(`Rapoarte generate: ${data?.generated||0}`); await loadAll(); });

(async()=>{ ctx=await requireStaff(); if(!ctx)return; $("#fleet-trip-month").value=new Date().toISOString().slice(0,7); await loadAll(); })();