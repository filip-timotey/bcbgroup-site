import { requireStaff, supabase, esc, fmtDate } from "./admin-common.js";
const root=document.querySelector("#dc-grid");
const defs=[
  {key:"quotes",label:"Cereri de ofertă",table:"quote_requests",select:"id,full_name,phone,created_at",title:r=>r.full_name||"Cerere ofertă",meta:r=>`${r.phone||""} · ${fmtDate(r.created_at)}`},order:"created_at"},
  {key:"media",label:"Media proiecte",table:"project_media",select:"id,title,media_type,storage_path,created_at",title:r=>r.title||r.media_type||"Media",meta:r=>`${r.media_type||""} · ${fmtDate(r.created_at)}`,order:"created_at",storage:"project-media",path:"storage_path"},
  {key:"journal",label:"Jurnal șantier",table:"site_journal_entries",select:"id,work_date,work_summary,stage,created_at",title:r=>r.work_summary||"Activitate jurnal",meta:r=>`${r.work_date||""} · ${r.stage||""}`,order:"created_at"},
  {key:"trips",label:"Curse Fleet",table:"fleet_trips",select:"id,origin,destination,purpose,start_at,status",title:r=>`${r.origin||"—"} → ${r.destination||"—"}`,meta:r=>`${r.purpose||""} · ${fmtDate(r.start_at)} · ${r.status}`,order:"start_at"},
  {key:"fuel",label:"Alimentări Fleet",table:"fleet_fuel_entries",select:"id,liters,total_amount,fueled_at,receipt_path",title:r=>`${Number(r.liters||0).toLocaleString("ro-RO")} L`,meta:r=>`${r.total_amount!=null?Number(r.total_amount).toLocaleString("ro-RO")+" lei":""} · ${fmtDate(r.fueled_at)}`,order:"fueled_at",storage:"fleet-documents",path:"receipt_path"},
  {key:"documents",label:"Documente Fleet",table:"fleet_documents",select:"id,document_type,document_number,file_path,expires_at,created_at",title:r=>`${String(r.document_type||"").toUpperCase()} ${r.document_number||""}`,meta:r=>r.expires_at?`Expiră ${r.expires_at}`:"Fără expirare",order:"created_at",storage:"fleet-documents",path:"file_path"},
  {key:"reports",label:"Rapoarte Fleet",table:"fleet_reports",select:"id,report_number,pdf_path,xlsx_path,generated_at",title:r=>r.report_number||"Raport Fleet",meta:r=>r.generated_at?fmtDate(r.generated_at):"",order:"generated_at",storageMulti:r=>[r.pdf_path,r.xlsx_path].filter(Boolean)}
];
let data={};
async function load(){
  const ctx=await requireStaff();
  if(!ctx||ctx.profile.role!=="admin"){location.replace("dashboard.html");return;}
  const results=await Promise.all(defs.map(async d=>{const q=supabase.from(d.table).select(d.select).order(d.order,{ascending:false}).limit(50);const {data,error}=await q;return [d.key,error?[]:(data||[])];}));
  data=Object.fromEntries(results);render();
}
function render(){root.innerHTML=defs.map(d=>{const rows=data[d.key]||[];return `<article class="dc-card"><h3>${esc(d.label)} <span style="color:#999;font-size:10px">${rows.length}</span></h3>${rows.length?rows.map(r=>`<div class="dc-row" data-kind="${d.key}" data-id="${r.id}"><div><strong>${esc(d.title(r))}</strong><span>${esc(d.meta(r))}</span></div><button class="dc-delete" title="Șterge"><i class="fa-solid fa-trash"></i></button></div>`).join(""):'<div class="dc-empty">Nu există înregistrări.</div>'}</article>`}).join("");}
root?.addEventListener("click",async e=>{
  const btn=e.target.closest(".dc-delete");if(!btn)return;
  const row=e.target.closest(".dc-row");const d=defs.find(x=>x.key===row.dataset.kind);const item=(data[d.key]||[]).find(x=>String(x.id)===row.dataset.id);if(!d||!item)return;
  if(!confirm(`Ștergi definitiv: ${d.title(item)}?`))return;
  btn.disabled=true;
  if(d.storage&&item[d.path]){const rm=await supabase.storage.from(d.storage).remove([item[d.path]]);if(rm.error){btn.disabled=false;alert(rm.error.message);return;}}
  if(d.storageMulti){const paths=d.storageMulti(item);if(paths.length){const rm=await supabase.storage.from("fleet-reports").remove(paths);if(rm.error){btn.disabled=false;alert(rm.error.message);return;}}}
  const {error}=await supabase.from(d.table).delete().eq("id",item.id);if(error){btn.disabled=false;alert(error.message);return;}
  data[d.key]=data[d.key].filter(x=>x.id!==item.id);render();
});
load();