import { requireStaff, supabase, esc, fmtDate } from "./admin-common.js";

const root = document.querySelector("#dc-grid");
const defs = [
  {key:"quotes",label:"Cereri de ofertă",table:"quote_requests",select:"id,full_name,phone,created_at",title:r=>r.full_name||"Cerere ofertă",meta:r=>`${r.phone||""} · ${fmtDate(r.created_at)}`,order:"created_at"},
  {key:"media",label:"Media proiecte",table:"project_media",select:"id,title,media_type,storage_path,created_at",title:r=>r.title||r.media_type||"Media",meta:r=>`${r.media_type||""} · ${fmtDate(r.created_at)}`,order:"created_at",storage:"project-media",path:"storage_path"},
  {key:"journal",label:"Jurnal șantier",table:"site_journal_entries",select:"id,work_date,work_summary,stage,created_at",title:r=>r.work_summary||"Activitate jurnal",meta:r=>`${r.work_date||""} · ${r.stage||""}`,order:"created_at"},
  {key:"trips",label:"Curse Fleet",table:"fleet_trips",select:"id,origin,destination,purpose,start_at,status",title:r=>`${r.origin||"—"} → ${r.destination||"—"}`,meta:r=>`${r.purpose||""} · ${fmtDate(r.start_at)} · ${r.status}`,order:"start_at"},
  {key:"fuel",label:"Alimentări Fleet",table:"fleet_fuel_entries",select:"id,liters,total_amount,fueled_at,receipt_path",title:r=>`${Number(r.liters||0).toLocaleString("ro-RO")} L`,meta:r=>`${r.total_amount!=null?Number(r.total_amount).toLocaleString("ro-RO")+" lei":""} · ${fmtDate(r.fueled_at)}`,order:"fueled_at",storage:"fleet-documents",path:"receipt_path"},
  {key:"documents",label:"Documente Fleet",table:"fleet_documents",select:"id,document_type,document_number,file_path,expires_at,created_at",title:r=>`${String(r.document_type||"").toUpperCase()} ${r.document_number||""}`,meta:r=>r.expires_at?`Expiră ${r.expires_at}`:"Fără expirare",order:"created_at",storage:"fleet-documents",path:"file_path"},
  {key:"reports",label:"Rapoarte Fleet",table:"fleet_reports",select:"id,report_number,pdf_path,xlsx_path,generated_at",title:r=>r.report_number||"Raport Fleet",meta:r=>r.generated_at?fmtDate(r.generated_at):"",order:"generated_at",storageMulti:r=>[r.pdf_path,r.xlsx_path].filter(Boolean)}
];

const state = new Map(defs.map((d) => [d.key, { status:"pending", rows:[] }]));

function renderCard(def) {
  const section = state.get(def.key);
  if (section.status === "pending" || section.status === "loading") {
    return `<article class="dc-card" data-dc-card="${def.key}"><h3>${esc(def.label)}</h3><div class="dc-empty">Se încarcă…</div></article>`;
  }
  if (section.status === "error") {
    return `<article class="dc-card" data-dc-card="${def.key}"><h3>${esc(def.label)}</h3><div class="dc-empty">Nu am putut încărca această secțiune.</div></article>`;
  }
  const rows = section.rows;
  return `<article class="dc-card" data-dc-card="${def.key}"><h3>${esc(def.label)} <span style="color:#999;font-size:10px">${rows.length}</span></h3>${rows.length?rows.map(r=>`<div class="dc-row" data-kind="${def.key}" data-id="${r.id}"><div><strong>${esc(def.title(r))}</strong><span>${esc(def.meta(r))}</span></div><button class="dc-delete" title="Șterge"><i class="fa-solid fa-trash"></i></button></div>`).join(""):'<div class="dc-empty">Nu există înregistrări.</div>'}</article>`;
}

function render() {
  root.innerHTML = defs.map(renderCard).join("");
}

async function loadSection(def) {
  const section = state.get(def.key);
  if (!section || section.status === "loading" || section.status === "ready") return;
  section.status = "loading";
  render();

  const { data, error } = await supabase
    .from(def.table)
    .select(def.select)
    .order(def.order, { ascending:false })
    .limit(50);

  section.status = error ? "error" : "ready";
  section.rows = error ? [] : (data || []);
  if (error) console.error(`Data Control ${def.key}:`, error);
  render();
}

function scheduleRemaining(startIndex = 1) {
  const run = async () => {
    for (let i = startIndex; i < defs.length; i += 1) {
      await loadSection(defs[i]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
  if ("requestIdleCallback" in window) requestIdleCallback(() => run(), { timeout:1200 });
  else setTimeout(run, 50);
}

async function load() {
  const ctx = await requireStaff();
  if (!ctx || ctx.profile.role !== "admin") {
    location.replace("dashboard.html");
    return;
  }
  render();
  await loadSection(defs[0]);
  scheduleRemaining(1);
}

root?.addEventListener("click", async (event) => {
  const btn = event.target.closest(".dc-delete");
  if (!btn) return;
  const row = event.target.closest(".dc-row");
  const def = defs.find((item) => item.key === row?.dataset.kind);
  const section = def ? state.get(def.key) : null;
  const item = section?.rows.find((entry) => String(entry.id) === row.dataset.id);
  if (!def || !item) return;
  if (!confirm(`Ștergi definitiv: ${def.title(item)}?`)) return;

  btn.disabled = true;
  if (def.storage && item[def.path]) {
    const rm = await supabase.storage.from(def.storage).remove([item[def.path]]);
    if (rm.error) { btn.disabled=false; alert(rm.error.message); return; }
  }
  if (def.storageMulti) {
    const paths = def.storageMulti(item);
    if (paths.length) {
      const rm = await supabase.storage.from("fleet-reports").remove(paths);
      if (rm.error) { btn.disabled=false; alert(rm.error.message); return; }
    }
  }

  const { error } = await supabase.from(def.table).delete().eq("id", item.id);
  if (error) { btn.disabled=false; alert(error.message); return; }
  section.rows = section.rows.filter((entry) => entry.id !== item.id);
  render();
});

load();
