import { requireStaff, supabase, esc } from "./admin-common.js";

let ctx=null;
const modal=document.querySelector("#fleet-modal");
const content=document.querySelector("#fleet-modal-content");
const openModal=(html)=>{content.innerHTML=html;modal.hidden=false;};
const closeModal=()=>{modal.hidden=true;content.innerHTML="";};
const vehicleOptions=async()=>{const {data}=await supabase.from("fleet_vehicles").select("id,registration_number,make,model").eq("is_active",true).order("registration_number");return (data||[]).map(v=>`<option value="${v.id}">${esc(v.registration_number)} · ${esc(v.make)} ${esc(v.model)}</option>`).join("");};

async function addDocument(){
  if(ctx?.profile.role!=="admin")return;
  const options=await vehicleOptions();
  openModal(`<h2>Document vehicul</h2><p style="color:#777;font-size:10px;margin-top:5px">RCA, ITP, rovinietă, CASCO, service sau alte documente cu expirare.</p><form id="fleet-document-form" class="fleet-form"><label>Vehicul<select name="vehicle_id" required>${options}</select></label><label>Tip<select name="document_type"><option value="rca">RCA</option><option value="itp">ITP</option><option value="rovinieta">Rovinietă</option><option value="casco">CASCO</option><option value="talon">Talon</option><option value="service">Service</option><option value="leasing">Leasing</option><option value="other">Altul</option></select></label><label>Număr document<input name="document_number"></label><label>Data emiterii<input name="issued_at" type="date"></label><label>Data expirării<input name="expires_at" type="date"></label><label>Avertizare înainte cu<input name="reminder_days" type="number" min="0" max="365" value="30"></label><label class="wide">Fișier document<input name="file" type="file" accept="image/*,.pdf"></label><label class="wide">Observații<textarea name="notes"></textarea></label><button type="submit">SALVEAZĂ DOCUMENTUL</button></form>`);
  document.querySelector("#fleet-document-form")?.addEventListener("submit",async e=>{
    e.preventDefault(); const fd=new FormData(e.currentTarget); const file=fd.get("file"); let filePath=null;
    if(file instanceof File && file.size){ const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"-"); filePath=`${fd.get("vehicle_id")}/${crypto.randomUUID()}-${safeName}`; const up=await supabase.storage.from("fleet-documents").upload(filePath,file,{contentType:file.type||undefined}); if(up.error){alert(up.error.message);return;} }
    const payload={vehicle_id:fd.get("vehicle_id"),document_type:fd.get("document_type"),document_number:String(fd.get("document_number")||"").trim()||null,issued_at:fd.get("issued_at")||null,expires_at:fd.get("expires_at")||null,reminder_days:Number(fd.get("reminder_days")||30),file_path:filePath,notes:String(fd.get("notes")||"").trim()||null};
    const {error}=await supabase.from("fleet_documents").insert(payload); if(error){alert(error.message);return;} closeModal(); location.reload();
  });
}

async function signed(path){ if(!path)return null; const {data,error}=await supabase.storage.from("fleet-reports").createSignedUrl(path,3600); if(error)throw error; return data.signedUrl; }

async function openReport(id){
  const {data:r,error}=await supabase.from("fleet_reports").select("*").eq("id",id).single(); if(error||!r){alert(error?.message||"Raport indisponibil");return;}
  let pdf=null,xlsx=null; try{[pdf,xlsx]=await Promise.all([signed(r.pdf_path),signed(r.xlsx_path)]);}catch(e){alert(e.message);return;}
  const shareText=encodeURIComponent(`BCB Group · Foaie de parcurs ${r.report_number}\n${pdf||""}`);
  openModal(`<h2>${esc(r.report_number)}</h2><p style="color:#777;font-size:10px;margin:5px 0 18px">Documentele sunt accesibile prin link securizat temporar.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><a class="fleet-admin-action" style="text-align:center;text-decoration:none" href="${pdf}" target="_blank"><i class="fa-solid fa-file-pdf"></i> PDF / IMPRIMĂ</a><a class="fleet-admin-action" style="text-align:center;text-decoration:none" href="${xlsx}" target="_blank"><i class="fa-solid fa-file-excel"></i> EXCEL</a><a class="fleet-admin-action" style="text-align:center;text-decoration:none;background:#198754" href="https://wa.me/?text=${shareText}" target="_blank"><i class="fa-brands fa-whatsapp"></i> WHATSAPP</a><button id="fleet-email-report-now" class="fleet-admin-action" ${ctx.profile.role!=="admin"?'hidden':''}><i class="fa-solid fa-envelope"></i> EMAIL</button><button id="fleet-copy-report-link" class="fleet-admin-action"><i class="fa-solid fa-link"></i> COPIAZĂ LINK PDF</button><button id="fleet-delete-report" class="fleet-admin-action" style="background:#8b3a32" ${ctx.profile.role!=="admin"?'hidden':''}><i class="fa-solid fa-trash"></i> ȘTERGE RAPORT</button></div><p style="margin-top:14px;color:#969a9d;font-size:8px">Linkurile securizate expiră după o oră. Fișierele originale rămân în arhiva privată Fleet.</p>`);
  document.querySelector("#fleet-copy-report-link")?.addEventListener("click",async()=>{await navigator.clipboard.writeText(pdf);alert("Linkul PDF a fost copiat.");});
  document.querySelector("#fleet-email-report-now")?.addEventListener("click",async()=>{const btn=document.querySelector("#fleet-email-report-now");btn.disabled=true;btn.textContent="Se trimite...";const {data,error}=await supabase.functions.invoke("generate-fleet-reports",{body:{year:r.report_year,month:r.report_month,vehicle_id:r.vehicle_id,driver_id:r.driver_id,send_email:true}});if(error)alert(error.message);else alert(data?.emailed?"Raportul a fost trimis pe email.":"Raport generat; verifică setarea email.");btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-envelope"></i> EMAIL';});
  document.querySelector("#fleet-delete-report")?.addEventListener("click",async()=>{if(!confirm("Ștergi definitiv această foaie de parcurs și fișierele PDF/Excel?"))return; if(r.pdf_path)await supabase.storage.from("fleet-reports").remove([r.pdf_path]);if(r.xlsx_path)await supabase.storage.from("fleet-reports").remove([r.xlsx_path]);const {error}=await supabase.from("fleet_reports").delete().eq("id",r.id);if(error){alert(error.message);return;}closeModal();location.reload();});
}

document.addEventListener("click",e=>{
  const add=e.target.closest("#fleet-add-document"); if(add){addDocument();return;}
  const report=e.target.closest(".fleet-report-actions"); if(report)openReport(report.dataset.id);
});

(async()=>{ctx=await requireStaff();})();