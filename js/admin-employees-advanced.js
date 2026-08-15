import { supabase } from './supabase-client.js';
import { requireStaffContext, isOwnerProfile } from './admin-session.js';

const $=s=>document.querySelector(s);
const esc=(v='')=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const fmt=v=>v?new Intl.DateTimeFormat('ro-RO').format(new Date(`${v}T12:00:00`)):'—';
let ctx=null,employees=[],state={leave:[],time:[],certs:[],equipment:[],alerts:[]};

const leaveLabels={annual:'Concediu odihnă',medical:'Medical',unpaid:'Fără plată',special:'Special',parental:'Parental',other:'Altul'};
const certTypeLabels={training:'Instruire',authorization:'Autorizație',medical:'Aviz medical',safety:'SSM / PSI',technical:'Certificare tehnică',other:'Altul'};
const equipmentLabels={ppe:'EIP',tool:'Scule',phone:'Telefon',laptop:'Laptop',vehicle:'Vehicul',access:'Acces / cheie',other:'Altul'};

function employeeName(id){return employees.find(e=>e.id===id)?.full_name||'Angajat';}
function employeeOptions(selected=''){return employees.map(e=>`<option value="${e.id}" ${e.id===selected?'selected':''}>${esc(e.full_name)}${e.employee_code?` · ${esc(e.employee_code)}`:''}</option>`).join('');}
function daysBetween(a,b){if(!a||!b)return 0;return Math.floor((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000)+1;}
function hours(entry){if(!entry.started_at||!entry.ended_at)return '—';const ms=new Date(entry.ended_at)-new Date(entry.started_at)-Number(entry.break_minutes||0)*60000;return `${Math.max(0,ms/3600000).toFixed(1)} h`;}

function installShell(){
  if($('#hr-advanced'))return;
  const toolbar=$('.employees-toolbar');
  const section=document.createElement('section');
  section.id='hr-advanced';section.className='hr-advanced';
  section.innerHTML=`<nav class="hr-tabs" aria-label="Module HR">
    <button class="is-active" data-hr-tab="directory"><i class="fa-solid fa-address-card"></i> Evidență</button>
    <button data-hr-tab="alerts"><i class="fa-solid fa-bell"></i> Alerte <span id="hr-alert-badge">0</span></button>
    <button data-hr-tab="leave"><i class="fa-solid fa-umbrella-beach"></i> Concedii</button>
    <button data-hr-tab="time"><i class="fa-solid fa-clock"></i> Pontaj</button>
    <button data-hr-tab="certs"><i class="fa-solid fa-certificate"></i> Instruiri & autorizații</button>
    <button data-hr-tab="equipment"><i class="fa-solid fa-toolbox"></i> Echipamente</button>
  </nav><div id="hr-workspace" class="hr-workspace" hidden></div>`;
  toolbar?.before(section);
  section.querySelectorAll('[data-hr-tab]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.hrTab)));
}

function switchTab(tab){
  document.querySelectorAll('[data-hr-tab]').forEach(b=>b.classList.toggle('is-active',b.dataset.hrTab===tab));
  const directoryEls=[$('.employees-toolbar'),$('#employees-grid')];
  const workspace=$('#hr-workspace');
  if(tab==='directory'){directoryEls.forEach(x=>x&&(x.hidden=false));workspace.hidden=true;return;}
  directoryEls.forEach(x=>x&&(x.hidden=true));workspace.hidden=false;renderTab(tab);
}

async function loadData(){
  const [e,l,t,c,q,a]=await Promise.all([
    supabase.from('employees').select('id,full_name,employee_code,job_title,department,employment_status').order('full_name'),
    supabase.from('employee_leave').select('*').order('starts_on',{ascending:false}).limit(300),
    supabase.from('employee_time_entries').select('*').order('work_date',{ascending:false}).limit(500),
    supabase.from('employee_certifications').select('*').order('expires_on',{ascending:true}).limit(300),
    supabase.from('employee_equipment').select('*').order('assigned_on',{ascending:false}).limit(300),
    supabase.rpc('get_hr_alerts',{p_days:30})
  ]);
  const err=e.error||l.error||t.error||c.error||q.error;
  if(err){console.warn('HR advanced module not active yet:',err);return;}
  employees=e.data||[];state.leave=l.data||[];state.time=t.data||[];state.certs=c.data||[];state.equipment=q.data||[];state.alerts=a.data||[];
  const badge=$('#hr-alert-badge');if(badge)badge.textContent=state.alerts.length;
}

function workspace(title,desc,action=''){
  return `<div class="hr-workspace-head"><div><span>People Operations</span><h2>${title}</h2><p>${desc}</p></div>${action}</div><div id="hr-workspace-body"></div>`;
}
function empty(text){return `<div class="hr-empty"><i class="fa-solid fa-folder-open"></i><p>${text}</p></div>`;}
function statusBadge(label,kind='neutral'){return `<span class="hr-status is-${kind}">${esc(label)}</span>`;}

function renderTab(tab){
  const w=$('#hr-workspace');
  if(tab==='alerts')renderAlerts(w);
  if(tab==='leave')renderLeave(w);
  if(tab==='time')renderTime(w);
  if(tab==='certs')renderCerts(w);
  if(tab==='equipment')renderEquipment(w);
}

function renderAlerts(w){
  w.innerHTML=workspace('Alerte HR','Contracte, documente, autorizații și echipamente care necesită atenție în următoarele 30 de zile.',isOwnerProfile(ctx.profile)?'<button class="hr-primary" id="hr-alert-settings"><i class="fa-solid fa-sliders"></i> Setări alerte</button>':'');
  const body=$('#hr-workspace-body');
  body.innerHTML=state.alerts.length?`<div class="hr-alert-list">${state.alerts.map(a=>`<article class="hr-alert-card is-${a.days_left<=7?'urgent':'warning'}"><div class="hr-alert-icon"><i class="fa-solid ${a.alert_type==='contract'?'fa-file-signature':a.alert_type==='document'?'fa-file-lines':a.alert_type==='certification'?'fa-certificate':'fa-toolbox'}"></i></div><div><strong>${esc(a.title)}</strong><p>${esc(a.employee_name)}</p><span>Scadență ${fmt(a.due_date)} · ${a.days_left===0?'astăzi':`${a.days_left} zile`}</span></div>${statusBadge(a.days_left<=7?'Prioritate':'În atenție',a.days_left<=7?'danger':'warning')}</article>`).join('')}</div>`:empty('Nu există scadențe în următoarele 30 de zile.');
  $('#hr-alert-settings')?.addEventListener('click',openAlertSettings);
}

function renderLeave(w){
  w.innerHTML=workspace('Concedii & absențe','Perioade de concediu, medical, fără plată și alte absențe aprobate.','<button class="hr-primary" id="hr-add-leave"><i class="fa-solid fa-plus"></i> Adaugă absență</button>');
  const rows=state.leave;
  $('#hr-workspace-body').innerHTML=rows.length?`<div class="hr-table-wrap"><table class="hr-table"><thead><tr><th>Angajat</th><th>Tip</th><th>Perioadă</th><th>Zile</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(employeeName(x.employee_id))}</strong></td><td>${esc(leaveLabels[x.leave_type]||x.leave_type)}</td><td>${fmt(x.starts_on)} → ${fmt(x.ends_on)}</td><td>${daysBetween(x.starts_on,x.ends_on)}</td><td>${statusBadge(x.status==='approved'?'Aprobat':x.status,x.status==='approved'?'success':'neutral')}</td><td><button class="hr-icon-btn" data-delete-leave="${x.id}"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('')}</tbody></table></div>`:empty('Nu există concedii sau absențe înregistrate.');
  $('#hr-add-leave')?.addEventListener('click',()=>openForm('leave'));
  document.querySelectorAll('[data-delete-leave]').forEach(b=>b.addEventListener('click',()=>removeRow('employee_leave',b.dataset.deleteLeave)));
}

function renderTime(w){
  w.innerHTML=workspace('Pontaj','Înregistrări de lucru, ore suplimentare, șantier, remote și instruire.','<button class="hr-primary" id="hr-add-time"><i class="fa-solid fa-plus"></i> Adaugă pontaj</button>');
  $('#hr-workspace-body').innerHTML=state.time.length?`<div class="hr-table-wrap"><table class="hr-table"><thead><tr><th>Data</th><th>Angajat</th><th>Tip</th><th>Interval</th><th>Total</th><th>Loc</th><th></th></tr></thead><tbody>${state.time.map(x=>`<tr><td>${fmt(x.work_date)}</td><td><strong>${esc(employeeName(x.employee_id))}</strong></td><td>${esc(x.entry_type)}</td><td>${x.started_at?new Date(x.started_at).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'}):'—'} → ${x.ended_at?new Date(x.ended_at).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'}):'—'}</td><td>${hours(x)}</td><td>${esc(x.work_location||'—')}</td><td><button class="hr-icon-btn" data-delete-time="${x.id}"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('')}</tbody></table></div>`:empty('Nu există pontaje înregistrate.');
  $('#hr-add-time')?.addEventListener('click',()=>openForm('time'));
  document.querySelectorAll('[data-delete-time]').forEach(b=>b.addEventListener('click',()=>removeRow('employee_time_entries',b.dataset.deleteTime)));
}

function renderCerts(w){
  w.innerHTML=workspace('Instruiri & autorizații','Certificări, autorizații, avize medicale, SSM/PSI și instruiri cu expirare.','<button class="hr-primary" id="hr-add-cert"><i class="fa-solid fa-plus"></i> Adaugă certificare</button>');
  $('#hr-workspace-body').innerHTML=state.certs.length?`<div class="hr-card-grid">${state.certs.map(x=>{const days=x.expires_on?Math.ceil((new Date(`${x.expires_on}T12:00:00`)-Date.now())/86400000):null;return `<article class="hr-info-card"><div class="hr-info-card-top"><i class="fa-solid fa-certificate"></i>${days!=null&&days<0?statusBadge('Expirat','danger'):days!=null&&days<=30?statusBadge('Expiră curând','warning'):statusBadge('Valid','success')}</div><h3>${esc(x.title)}</h3><p>${esc(employeeName(x.employee_id))}</p><dl><div><dt>Tip</dt><dd>${esc(certTypeLabels[x.certification_type]||x.certification_type)}</dd></div><div><dt>Emitent</dt><dd>${esc(x.issuer||'—')}</dd></div><div><dt>Expiră</dt><dd>${fmt(x.expires_on)}</dd></div></dl><button class="hr-delete-link" data-delete-cert="${x.id}"><i class="fa-solid fa-trash"></i> Șterge</button></article>`}).join('')}</div>`:empty('Nu există instruiri sau autorizații înregistrate.');
  $('#hr-add-cert')?.addEventListener('click',()=>openForm('cert'));
  document.querySelectorAll('[data-delete-cert]').forEach(b=>b.addEventListener('click',()=>removeRow('employee_certifications',b.dataset.deleteCert)));
}

function renderEquipment(w){
  w.innerHTML=workspace('Echipamente predate','Scule, EIP, telefoane, laptopuri, chei, vehicule sau alte bunuri aflate la angajați.','<button class="hr-primary" id="hr-add-equipment"><i class="fa-solid fa-plus"></i> Predă echipament</button>');
  $('#hr-workspace-body').innerHTML=state.equipment.length?`<div class="hr-table-wrap"><table class="hr-table"><thead><tr><th>Angajat</th><th>Echipament</th><th>Cod / serie</th><th>Predat</th><th>Retur</th><th>Status</th><th></th></tr></thead><tbody>${state.equipment.map(x=>`<tr><td><strong>${esc(employeeName(x.employee_id))}</strong></td><td>${esc(x.item_name)}<small>${esc(equipmentLabels[x.category]||x.category)}</small></td><td>${esc(x.asset_code||x.serial_number||'—')}</td><td>${fmt(x.assigned_on)}</td><td>${fmt(x.returned_on||x.expected_return_on)}</td><td>${statusBadge(x.status==='assigned'?'Predat':x.status,x.status==='assigned'?'warning':'success')}</td><td><button class="hr-icon-btn" data-return-equipment="${x.id}" title="Marchează returnat"><i class="fa-solid fa-rotate-left"></i></button><button class="hr-icon-btn" data-delete-equipment="${x.id}"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('')}</tbody></table></div>`:empty('Nu există echipamente atribuite.');
  $('#hr-add-equipment')?.addEventListener('click',()=>openForm('equipment'));
  document.querySelectorAll('[data-return-equipment]').forEach(b=>b.addEventListener('click',()=>markReturned(b.dataset.returnEquipment)));
  document.querySelectorAll('[data-delete-equipment]').forEach(b=>b.addEventListener('click',()=>removeRow('employee_equipment',b.dataset.deleteEquipment)));
}

function modalHtml(title,fields){return `<div class="hr-form-modal is-open" id="hr-form-modal"><div class="hr-form-backdrop" data-close></div><section><button class="hr-form-close" data-close>×</button><span>BCB People Operations</span><h2>${title}</h2><form id="hr-form">${fields}<div id="hr-form-message"></div><button class="hr-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Salvează</button></form></section></div>`;}
function mountModal(html){document.body.insertAdjacentHTML('beforeend',html);const m=$('#hr-form-modal');m.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',()=>m.remove()));return m;}

function openForm(type){
  let title='',fields='';
  if(type==='leave'){title='Adaugă concediu / absență';fields=`<label>Angajat<select name="employee_id" required>${employeeOptions()}</select></label><label>Tip<select name="leave_type">${Object.entries(leaveLabels).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label>Începe<input type="date" name="starts_on" required></label><label>Se termină<input type="date" name="ends_on" required></label><label>Status<select name="status"><option value="approved">Aprobat</option><option value="pending">În așteptare</option><option value="rejected">Respins</option><option value="cancelled">Anulat</option></select></label><label class="wide">Motiv / observații<textarea name="reason"></textarea></label>`;}
  if(type==='time'){title='Adaugă pontaj';fields=`<label>Angajat<select name="employee_id" required>${employeeOptions()}</select></label><label>Data<input type="date" name="work_date" required></label><label>Tip<select name="entry_type"><option value="work">Lucru</option><option value="overtime">Ore suplimentare</option><option value="site">Șantier</option><option value="remote">Remote</option><option value="training">Instruire</option><option value="other">Altul</option></select></label><label>Start<input type="datetime-local" name="started_at"></label><label>Final<input type="datetime-local" name="ended_at"></label><label>Pauză (minute)<input type="number" name="break_minutes" min="0" value="0"></label><label>Locație<input name="work_location"></label><label class="wide">Note<textarea name="notes"></textarea></label>`;}
  if(type==='cert'){title='Adaugă instruire / autorizație';fields=`<label>Angajat<select name="employee_id" required>${employeeOptions()}</select></label><label>Tip<select name="certification_type">${Object.entries(certTypeLabels).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label class="wide">Denumire<input name="title" required></label><label>Emitent<input name="issuer"></label><label>Număr certificat<input name="certificate_number"></label><label>Emis la<input type="date" name="issued_on"></label><label>Expiră la<input type="date" name="expires_on"></label><label class="wide">Note<textarea name="notes"></textarea></label>`;}
  if(type==='equipment'){title='Predă echipament';fields=`<label>Angajat<select name="employee_id" required>${employeeOptions()}</select></label><label>Categorie<select name="category">${Object.entries(equipmentLabels).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label class="wide">Echipament<input name="item_name" required></label><label>Cod inventar<input name="asset_code"></label><label>Serie<input name="serial_number"></label><label>Data predării<input type="date" name="assigned_on" value="${new Date().toISOString().slice(0,10)}"></label><label>Retur estimat<input type="date" name="expected_return_on"></label><label>Stare la predare<input name="condition_on_assign"></label><label>Valoare estimată<input type="number" step="0.01" min="0" name="value"></label><label class="wide">Note<textarea name="notes"></textarea></label>`;}
  const m=mountModal(modalHtml(title,fields));
  m.querySelector('#hr-form').addEventListener('submit',e=>saveForm(e,type));
}

async function saveForm(e,type){
  e.preventDefault();const form=e.currentTarget,msg=form.querySelector('#hr-form-message');const fd=new FormData(form),payload={};for(const [k,v]of fd.entries())payload[k]=String(v).trim()||null;
  payload.created_by=ctx.session.user.id;
  if(type==='leave'&&payload.status==='approved')payload.approved_by=ctx.session.user.id;
  const table={leave:'employee_leave',time:'employee_time_entries',cert:'employee_certifications',equipment:'employee_equipment'}[type];
  msg.textContent='Se salvează…';
  const {error}=await supabase.from(table).insert(payload);
  if(error){msg.textContent=error.message;msg.className='is-error';return;}
  $('#hr-form-modal')?.remove();await loadData();switchTab(type==='cert'?'certs':type);
}

async function removeRow(table,id){if(!confirm('Ștergi această înregistrare?'))return;const {error}=await supabase.from(table).delete().eq('id',id);if(error){alert(error.message);return;}await loadData();const map={employee_leave:'leave',employee_time_entries:'time',employee_certifications:'certs',employee_equipment:'equipment'};switchTab(map[table]);}
async function markReturned(id){const {error}=await supabase.from('employee_equipment').update({status:'returned',returned_on:new Date().toISOString().slice(0,10),updated_by:ctx.session.user.id}).eq('id',id);if(error){alert(error.message);return;}await loadData();switchTab('equipment');}

async function openAlertSettings(){
  const {data}=await supabase.from('hr_alert_settings').select('*').eq('id',true).maybeSingle();
  const m=mountModal(modalHtml('Setări alerte HR',`<label>Email raport<input type="email" name="report_email" value="${esc(data?.report_email||'office@bcbgroup.ro')}"></label><label>Zile înainte<input type="number" min="1" max="365" name="days_before" value="${data?.days_before||30}"></label><label class="hr-check"><input type="checkbox" name="include_contracts" ${data?.include_contracts!==false?'checked':''}> Contracte</label><label class="hr-check"><input type="checkbox" name="include_documents" ${data?.include_documents!==false?'checked':''}> Documente</label><label class="hr-check"><input type="checkbox" name="include_certifications" ${data?.include_certifications!==false?'checked':''}> Autorizații</label><label class="hr-check"><input type="checkbox" name="include_equipment_returns" ${data?.include_equipment_returns!==false?'checked':''}> Retur echipamente</label>`));
  m.querySelector('#hr-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,fd=new FormData(f);const payload={id:true,report_email:fd.get('report_email')||null,days_before:Number(fd.get('days_before')||30),include_contracts:fd.has('include_contracts'),include_documents:fd.has('include_documents'),include_certifications:fd.has('include_certifications'),include_equipment_returns:fd.has('include_equipment_returns'),updated_by:ctx.session.user.id,updated_at:new Date().toISOString()};const {error}=await supabase.from('hr_alert_settings').upsert(payload);if(error){f.querySelector('#hr-form-message').textContent=error.message;return;}m.remove();});
}

(async function init(){
  ctx=await requireStaffContext({adminOnly:true});if(!ctx)return;
  installShell();await loadData();
})();
