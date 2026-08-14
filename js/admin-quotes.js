import { requireStaff, supabase, esc, fmtDate } from "./admin-common.js";

const list = document.querySelector("#quotes-list");
const search = document.querySelector("#quotes-search");
const filter = document.querySelector("#quotes-filter");
const refresh = document.querySelector("#quotes-refresh");
let rows = [];

const labels = { new:"Nouă", contacted:"Contactat", offer_sent:"Ofertă trimisă", accepted:"Acceptată", rejected:"Refuzată", archived:"Arhivată" };

function render() {
  const term = (search?.value || "").trim().toLowerCase();
  const status = filter?.value || "all";
  const filtered = rows.filter(r => {
    const hay = [r.full_name,r.phone,r.email,r.location,r.project_type].filter(Boolean).join(" ").toLowerCase();
    return (!term || hay.includes(term)) && (status === "all" || r.status === status);
  });
  if (!filtered.length) { list.innerHTML = '<div class="bcb-biz-empty">Nu există cereri pentru filtrul selectat.</div>'; return; }
  list.innerHTML = filtered.map(r => `
    <article class="bcb-biz-card" data-id="${esc(r.id)}">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap">
        <div><span class="bcb-biz-tag">${esc(labels[r.status] || r.status)}</span><h3 style="margin-top:8px">${esc(r.full_name)}</h3><div class="bcb-biz-meta"><span>${esc(r.phone)}</span><span>${esc(r.location || "Locație nespecificată")}</span><span>${esc(fmtDate(r.created_at))}</span></div></div>
        <select class="bcb-biz-status" data-field="status">${Object.entries(labels).map(([v,l]) => `<option value="${v}" ${r.status===v?"selected":""}>${l}</option>`).join("")}</select>
      </div>
      <p><strong>${esc(r.project_type || "Proiect")}</strong>${r.estimated_budget ? ` · ${esc(r.estimated_budget)}` : ""}${r.desired_start ? ` · ${esc(r.desired_start)}` : ""}</p>
      <p>${esc(r.message)}</p>
      <textarea class="bcb-biz-notes" data-field="notes" placeholder="Notițe interne BCB...">${esc(r.internal_notes || "")}</textarea>
      <div class="bcb-biz-card-actions">
        <a class="is-primary" href="tel:${esc(r.phone)}"><i class="fa-solid fa-phone"></i> Sună</a>
        <a class="is-whatsapp" href="https://wa.me/${String(r.phone||"").replace(/\D/g,"").replace(/^0/,"40")}" target="_blank"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
        ${r.email ? `<a href="mailto:${esc(r.email)}"><i class="fa-regular fa-envelope"></i> Email</a>` : ""}
        <button data-action="save"><i class="fa-solid fa-floppy-disk"></i> Salvează</button>
      </div>
    </article>`).join("");
}

async function load() {
  list.innerHTML = '<div class="bcb-biz-empty">Se încarcă solicitările…</div>';
  const { data, error } = await supabase.from("quote_requests").select("*").order("created_at", { ascending:false });
  if (error) { console.error(error); list.innerHTML = '<div class="bcb-biz-empty">Modulul Cereri de ofertă așteaptă activarea schemei Supabase.</div>'; return; }
  rows = data || []; render();
}

list?.addEventListener("click", async e => {
  const btn = e.target.closest("button[data-action='save']");
  const card = e.target.closest("[data-id]");
  if (!btn || !card) return;
  btn.disabled = true;
  const status = card.querySelector("[data-field='status']")?.value;
  const notes = card.querySelector("[data-field='notes']")?.value.trim() || null;
  const { error } = await supabase.from("quote_requests").update({ status, internal_notes:notes }).eq("id", card.dataset.id);
  btn.disabled = false;
  if (error) return alert("Nu am putut salva modificarea.");
  await load();
});

search?.addEventListener("input", render);
filter?.addEventListener("change", render);
refresh?.addEventListener("click", load);

(async()=>{ if (await requireStaff()) await load(); })();
