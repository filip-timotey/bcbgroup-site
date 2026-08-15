import { requireStaff, supabase } from "./admin-common.js";

let ctx;
let vehicles=[];
let trips=[];
let documents=[];
let fuel=[];
let reports=[];
let profiles=[];

const fmtDate=(value)=>new Intl.DateTimeFormat("ro-RO",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(value));
const vehicleLabel=(id)=>{const v=vehicles.find(x=>x.id===id);return v?`${v.make} ${v.model} · ${v.registration_number}`:"Vehicul";};
const driverLabel=(id)=>{const p=profiles.find(x=>x.id===id);return p?.full_name||p?.email||"Șofer";};

function injectStyle(){
  if(document.querySelector("#fleet-delete-style"))return;
  const s=document.createElement("style");
  s.id="fleet-delete-style";
  s.textContent=`
  .fleet-danger-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:34px;padding:0 11px;border:1px solid rgba(158,49,49,.18);border-radius:10px;background:rgba(158,49,49,.08);color:#9d3434;font-size:9px;font-weight:900;cursor:pointer;transition:.2s ease}
  .fleet-danger-btn:hover{background:#9d3434;color:#fff;transform:translateY(-1px)}
  .fleet-inline-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
  .fleet-row-delete{width:32px;height:32px;padding:0;border-radius:9px}
  .fleet-admin-danger-note{margin:14px 0;padding:12px 14px;border-radius:12px;background:rgba(158,49,49,.07);border:1px solid rgba(158,49,49,.12);color:#7e3030;font-size:10px;line-height:1.5}
  @media(max-width:620px){.fleet-danger-btn{min-height:38px}.fleet-row-delete{width:36px;height:36px}}
  `;
  document.head.appendChild(s);
}

async function refreshData(){
  const [v,t,d,f,r,p]=await Promise.all([
    supabase.from("fleet_vehicles").select("*"),
    supabase.from("fleet_trips").select("*").order("start_at",{ascending:false}),
    supabase.from("fleet_documents").select("*"),
    supabase.from("fleet_fuel_entries").select("*").order("fueled_at",{ascending:false}),
    supabase.from("fleet_reports").select("*"),
    supabase.from("profiles").select("id,full_name,email")
  ]);
  vehicles=v.data||[];trips=t.data||[];documents=d.data||[];fuel=f.data||[];reports=r.data||[];profiles=p.data||[];
}

async function deleteReport(report){
  if(!report)return;
  if(!confirm(`Ștergi definitiv raportul ${report.report_number}? PDF-ul și Excel-ul vor fi șterse și din arhivă.`))return;
  const paths=[report.pdf_path,report.xlsx_path].filter(Boolean);
  if(paths.length){const rm=await supabase.storage.from("fleet-reports").remove(paths);if(rm.error){alert(rm.error.message);return;}}
  const {error}=await supabase.from("fleet_reports").delete().eq("id",report.id);
  if(error){alert(error.message);return;}
  location.reload();
}

async function deleteTrip(trip){
  if(!trip)return;
  const label=`${fmtDate(trip.start_at)} · ${vehicleLabel(trip.vehicle_id)} · ${trip.origin||"—"} → ${trip.destination||"—"}`;
  if(!confirm(`Ștergi definitiv cursa?\n\n${label}\n\nAceastă operațiune modifică istoricul Fleet și rapoartele regenerate ulterior.`))return;
  const {error}=await supabase.from("fleet_trips").delete().eq("id",trip.id);
  if(error){alert(error.message);return;}
  location.reload();
}

async function deleteFuel(entry){
  if(!entry)return;
  if(!confirm(`Ștergi alimentarea de ${Number(entry.liters||0).toLocaleString("ro-RO")} L pentru ${vehicleLabel(entry.vehicle_id)}?`))return;
  if(entry.receipt_path) await supabase.storage.from("fleet-documents").remove([entry.receipt_path]);
  const {error}=await supabase.from("fleet_fuel_entries").delete().eq("id",entry.id);
  if(error){alert(error.message);return;}
  location.reload();
}

async function deleteDocument(doc){
  if(!doc)return;
  if(!confirm(`Ștergi definitiv documentul ${String(doc.document_type||"").toUpperCase()} ${doc.document_number||""}?`))return;
  if(doc.file_path){const rm=await supabase.storage.from("fleet-documents").remove([doc.file_path]);if(rm.error){alert(rm.error.message);return;}}
  const {error}=await supabase.from("fleet_documents").delete().eq("id",doc.id);
  if(error){alert(error.message);return;}
  location.reload();
}

async function deleteVehicle(vehicle){
  if(!vehicle)return;
  const relatedTrips=trips.filter(x=>x.vehicle_id===vehicle.id).length;
  const relatedFuel=fuel.filter(x=>x.vehicle_id===vehicle.id).length;
  const relatedDocs=documents.filter(x=>x.vehicle_id===vehicle.id).length;
  const relatedReports=reports.filter(x=>x.vehicle_id===vehicle.id);
  const typed=prompt(`ȘTERGERE DEFINITIVĂ VEHICUL\n\n${vehicle.make} ${vehicle.model} · ${vehicle.registration_number}\n${relatedTrips} curse · ${relatedFuel} alimentări · ${relatedDocs} documente · ${relatedReports.length} rapoarte\n\nPentru confirmare scrie exact numărul de înmatriculare:`);
  if(typed===null)return;
  if(typed.trim().toUpperCase()!==String(vehicle.registration_number).trim().toUpperCase()){alert("Confirmarea nu corespunde. Vehiculul nu a fost șters.");return;}
  const reportPaths=relatedReports.flatMap(r=>[r.pdf_path,r.xlsx_path]).filter(Boolean);
  if(reportPaths.length) await supabase.storage.from("fleet-reports").remove(reportPaths);
  const docPaths=documents.filter(x=>x.vehicle_id===vehicle.id).map(x=>x.file_path).filter(Boolean);
  if(docPaths.length) await supabase.storage.from("fleet-documents").remove(docPaths);
  const steps=[
    supabase.from("fleet_fuel_entries").delete().eq("vehicle_id",vehicle.id),
    supabase.from("fleet_reports").delete().eq("vehicle_id",vehicle.id),
    supabase.from("fleet_vehicle_drivers").delete().eq("vehicle_id",vehicle.id),
    supabase.from("fleet_trips").delete().eq("vehicle_id",vehicle.id),
    supabase.from("fleet_documents").delete().eq("vehicle_id",vehicle.id)
  ];
  const results=await Promise.all(steps);
  const fail=results.find(x=>x.error)?.error;
  if(fail){alert(fail.message);return;}
  const {error}=await supabase.from("fleet_vehicles").delete().eq("id",vehicle.id);
  if(error){alert(error.message);return;}
  location.reload();
}

function addVehicleButtons(){
  document.querySelectorAll(".fleet-vehicle").forEach(card=>{
    if(card.querySelector("[data-fleet-delete-vehicle]"))return;
    const plate=card.querySelector(".fleet-plate")?.textContent.trim();
    const vehicle=vehicles.find(v=>String(v.registration_number).trim()===plate);
    if(!vehicle)return;
    let actions=card.querySelector(".fleet-inline-actions");
    if(!actions){actions=document.createElement("div");actions.className="fleet-inline-actions";card.appendChild(actions);}
    const btn=document.createElement("button");btn.type="button";btn.className="fleet-danger-btn";btn.dataset.fleetDeleteVehicle=vehicle.id;btn.innerHTML='<i class="fa-solid fa-trash"></i> Șterge';
    btn.addEventListener("click",()=>deleteVehicle(vehicle));actions.appendChild(btn);
  });
}

function addReportButtons(){
  document.querySelectorAll(".fleet-report-card").forEach(card=>{
    if(card.querySelector("[data-fleet-delete-report-card]"))return;
    const report=reports.find(r=>card.textContent.includes(r.report_number));if(!report)return;
    const btn=document.createElement("button");btn.type="button";btn.className="fleet-danger-btn fleet-row-delete";btn.dataset.fleetDeleteReportCard=report.id;btn.title="Șterge raport";btn.innerHTML='<i class="fa-solid fa-trash"></i>';
    btn.addEventListener("click",e=>{e.stopPropagation();deleteReport(report);});card.appendChild(btn);
  });
}

function addDocumentButtons(){
  document.querySelectorAll(".fleet-doc-card").forEach(card=>{
    if(card.querySelector("[data-fleet-delete-document]"))return;
    const doc=documents.find(d=>card.textContent.includes(String(d.document_number||"Fără număr"))&&card.textContent.toLowerCase().includes(String(d.document_type||"").toLowerCase()));
    if(!doc)return;
    const btn=document.createElement("button");btn.type="button";btn.className="fleet-danger-btn fleet-row-delete";btn.dataset.fleetDeleteDocument=doc.id;btn.title="Șterge document";btn.innerHTML='<i class="fa-solid fa-trash"></i>';
    btn.addEventListener("click",()=>deleteDocument(doc));card.appendChild(btn);
  });
}

function addTripButtons(){
  const table=document.querySelector("#fleet-all-trips table");if(!table)return;
  const head=table.querySelector("thead tr");if(head&&!head.querySelector("[data-delete-head]")){const th=document.createElement("th");th.dataset.deleteHead="1";th.textContent="";head.appendChild(th);}
  const used=new Set();
  table.querySelectorAll("tbody tr").forEach(row=>{
    if(row.querySelector("[data-fleet-delete-trip]"))return;
    const text=row.textContent;
    const trip=trips.find(t=>!used.has(t.id)&&text.includes(vehicleLabel(t.vehicle_id))&&text.includes(driverLabel(t.driver_id))&&text.includes(t.purpose||""));
    if(!trip)return;used.add(trip.id);
    const td=document.createElement("td");const btn=document.createElement("button");btn.type="button";btn.className="fleet-danger-btn fleet-row-delete";btn.dataset.fleetDeleteTrip=trip.id;btn.title="Șterge cursa";btn.innerHTML='<i class="fa-solid fa-trash"></i>';btn.addEventListener("click",()=>deleteTrip(trip));td.appendChild(btn);row.appendChild(td);
  });
}

function addFuelButtons(){
  const table=document.querySelector("#fleet-fuel-list table");if(!table)return;
  const head=table.querySelector("thead tr");if(head&&!head.querySelector("[data-delete-head]")){const th=document.createElement("th");th.dataset.deleteHead="1";th.textContent="";head.appendChild(th);}
  const used=new Set();
  table.querySelectorAll("tbody tr").forEach(row=>{
    if(row.querySelector("[data-fleet-delete-fuel]"))return;
    const text=row.textContent;
    const entry=fuel.find(f=>!used.has(f.id)&&text.includes(vehicleLabel(f.vehicle_id))&&text.includes(`${Number(f.liters).toLocaleString("ro-RO")} L`));
    if(!entry)return;used.add(entry.id);
    const td=document.createElement("td");const btn=document.createElement("button");btn.type="button";btn.className="fleet-danger-btn fleet-row-delete";btn.dataset.fleetDeleteFuel=entry.id;btn.title="Șterge alimentarea";btn.innerHTML='<i class="fa-solid fa-trash"></i>';btn.addEventListener("click",()=>deleteFuel(entry));td.appendChild(btn);row.appendChild(td);
  });
}

function enhance(){if(ctx?.profile?.role!=="admin")return;addVehicleButtons();addTripButtons();addFuelButtons();addDocumentButtons();addReportButtons();}

(async()=>{
  ctx=await requireStaff();if(!ctx||ctx.profile.role!=="admin")return;
  injectStyle();await refreshData();enhance();
  new MutationObserver(()=>enhance()).observe(document.querySelector(".bcb-admin-main")||document.body,{childList:true,subtree:true});
})();
