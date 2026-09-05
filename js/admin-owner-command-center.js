import { supabase } from './supabase-client.js';
import { requireStaffContext,isOwnerProfile } from './admin-session.js';

const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
let profiles=[],catalog=[],roleCaps=[],selectedUserId=null,busy=false;

function metric(icon,label,value,detail,state=''){return `<article class="occ-metric ${state}"><i class="fa-solid ${icon}"></i><div><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></div></article>`}
function initials(name=''){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'BC';}
function roleLabel(p){return p?.is_owner?'Owner':p?.role==='admin'?'Administrator':'Editor';}
function toast(text,error=false){const el=$('#occ-toast');if(!el)return;el.textContent=text;el.className=`occ-toast is-show${error?' is-error':''}`;clearTimeout(el._t);el._t=setTimeout(()=>el.className='occ-toast',3200);}
function categoryLabel(v){return v==='workspace'?'Workspace':v==='operations'?'Operațiuni':v==='administration'?'Administrare':'Acțiuni avansate';}

async function load(){
 const btn=$('#occ-refresh');if(btn)btn.disabled=true;
 try{
  await supabase.rpc('refresh_bcb_operations_center');
  const [summary,caps,audit,users,cat]=await Promise.all([
   supabase.rpc('owner_operations_summary'),
   supabase.from('role_capabilities').select('role,capability,enabled,updated_at').order('role').order('capability'),
   supabase.from('activity_log').select('id,action,entity_type,summary,created_at').order('created_at',{ascending:false}).limit(12),
   supabase.from('profiles').select('id,full_name,email,role,is_active,is_owner,avatar_path').eq('is_active',true).order('is_owner',{ascending:false}).order('full_name'),
   supabase.from('capability_catalog').select('capability,label,description,icon,href,category,sort_order,min_role,is_navigation,is_active').eq('is_active',true).order('sort_order')
  ]);
  if(summary.error)throw summary.error;if(users.error)throw users.error;if(cat.error)throw cat.error;
  profiles=users.data||[];catalog=cat.data||[];roleCaps=caps.data||[];
  const s=summary.data||{},h=s.health||{};
  $('#occ-metrics').innerHTML=[
   metric('fa-heart-pulse','System Health',`${h.score??'—'}/100`,h.status||'fără snapshot',h.status==='healthy'?'good':'warn'),
   metric('fa-users','Acces activ',s.users?.active??0,`${s.users?.archived??0} conturi arhivate`),
   metric('fa-user-clock','Aprobări',s.users?.pending_access??0,'cereri în așteptare',s.users?.pending_access?'warn':'good'),
   metric('fa-bell','Notificări',s.notifications?.unread??0,'necitite pentru Owner',s.notifications?.unread?'warn':'good'),
   metric('fa-clock-rotate-left','Audit 24h',s.audit?.last_24h??0,'operațiuni înregistrate')
  ].join('');
  renderRoleDefaults();renderUsers();renderAudit(audit);
  $('#occ-access-summary').textContent=`${profiles.length} utilizatori activi · ${catalog.filter(x=>x.is_navigation).length} module configurabile`;
  if(selectedUserId&&profiles.some(p=>p.id===selectedUserId))await selectUser(selectedUserId,false);
 }finally{if(btn)btn.disabled=false;}
}

function renderAudit(audit){
 $('#occ-audit').innerHTML=audit.error?'<p>Audit indisponibil momentan.</p>':(audit.data||[]).map(x=>`<div><i class="fa-solid fa-circle"></i><span><strong>${esc(x.summary||x.action)}</strong><small>${esc(x.entity_type)} · ${new Intl.DateTimeFormat('ro-RO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(x.created_at))}</small></span></div>`).join('')||'<p>Nu există activitate recentă.</p>';
}

function renderRoleDefaults(){
 const groups={admin:[],editor:[]};
 for(const role of ['admin','editor'])for(const c of catalog){const row=roleCaps.find(x=>x.role===role&&x.capability===c.capability);if(c.min_role==='admin'&&role==='editor')continue;groups[role].push({...c,enabled:row?.enabled??false});}
 $('#occ-capabilities').innerHTML=['admin','editor'].map(role=>`<div class="occ-role"><div class="occ-role-title"><strong>${role==='admin'?'Administrator':'Editor'}</strong><span>${groups[role].filter(x=>x.enabled).length}/${groups[role].length} active</span></div>${groups[role].map(x=>`<label class="occ-cap" title="${esc(x.description)}"><span><strong>${esc(x.label)}</strong><small>${esc(x.description)}</small></span><input type="checkbox" data-role="${role}" data-cap="${esc(x.capability)}" ${x.enabled?'checked':''}><i></i></label>`).join('')}</div>`).join('');
 $('#occ-capabilities').querySelectorAll('input').forEach(input=>input.addEventListener('change',async()=>{
  const next=input.checked;input.disabled=true;
  const {error}=await supabase.rpc('owner_set_role_capability',{p_role:input.dataset.role,p_capability:input.dataset.cap,p_enabled:next});
  if(error){input.checked=!next;toast('Permisiunea implicită nu a putut fi actualizată.',true);}else{toast('Permisiunea implicită a rolului a fost actualizată.');await refreshRoleCaps();if(selectedUserId)await selectUser(selectedUserId,false);}
  input.disabled=false;
 }));
}

async function refreshRoleCaps(){const {data,error}=await supabase.from('role_capabilities').select('role,capability,enabled,updated_at').order('role').order('capability');if(!error){roleCaps=data||[];renderRoleDefaults();}}

function renderUsers(filter=''){
 const q=filter.trim().toLocaleLowerCase('ro');const list=profiles.filter(p=>!q||`${p.full_name} ${p.email} ${roleLabel(p)}`.toLocaleLowerCase('ro').includes(q));
 $('#occ-user-list').innerHTML=list.map(p=>`<button class="occ-user-card${p.id===selectedUserId?' is-active':''}" data-user-id="${esc(p.id)}"><span class="occ-user-avatar">${esc(initials(p.full_name))}</span><span class="occ-user-copy"><strong>${esc(p.full_name||'Utilizator')}</strong><small>${esc(roleLabel(p))} · ${esc(p.email||'fără email')}</small></span>${p.is_owner?'<i class="fa-solid fa-crown"></i>':'<i class="fa-solid fa-chevron-right"></i>'}</button>`).join('')||'<div class="occ-list-empty">Niciun utilizator găsit.</div>';
 $('#occ-user-list').querySelectorAll('[data-user-id]').forEach(b=>b.addEventListener('click',()=>selectUser(b.dataset.userId)));
}

async function selectUser(userId,scroll=true){
 if(busy)return;selectedUserId=userId;renderUsers($('#occ-user-search')?.value||'');const p=profiles.find(x=>x.id===userId);if(!p)return;
 $('#occ-user-access-empty').hidden=true;$('#occ-user-access-content').hidden=false;$('#occ-selected-avatar').textContent=initials(p.full_name);$('#occ-selected-name').textContent=p.full_name||'Utilizator';$('#occ-selected-email').textContent=p.email||'—';$('#occ-selected-role').textContent=roleLabel(p);
 $('#occ-user-capabilities').innerHTML='<div class="occ-cap-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Se sincronizează accesul…</div>';
 const {data,error}=await supabase.rpc('get_effective_user_capabilities',{p_user_id:userId});
 if(error){$('#occ-user-capabilities').innerHTML='<div class="occ-cap-loading is-error">Accesul nu a putut fi încărcat.</div>';return;}
 renderUserCapabilities(p,data||[]);if(scroll&&window.innerWidth<900)$('#occ-user-access-content').scrollIntoView({behavior:'smooth',block:'start'});
}

function renderUserCapabilities(profile,items){
 const owner=profile.is_owner;const enabledNav=items.filter(x=>x.enabled&&x.is_navigation);
 $('#occ-nav-preview').innerHTML=['<span class="occ-preview-chip is-fixed"><i class="fa-solid fa-grid-2"></i> Dashboard</span>',...enabledNav.map(x=>`<span class="occ-preview-chip"><i class="fa-solid ${esc(x.icon)}"></i>${esc(x.label)}</span>`),...(owner?['<span class="occ-preview-chip is-owner"><i class="fa-solid fa-crown"></i> Command Center</span>']:[])].join('');
 const grouped=new Map();items.forEach(x=>{const k=x.category||'workspace';if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(x);});
 $('#occ-user-capabilities').innerHTML=[...grouped].map(([category,rows])=>`<section class="occ-cap-group"><div class="occ-cap-group-title"><strong>${categoryLabel(category)}</strong><span>${rows.filter(x=>x.enabled).length}/${rows.length} active</span></div>${rows.map(x=>{
   const locked=owner||x.source==='role_required';const personalized=x.source==='user';
   const sourceLabel=owner?'Owner permanent':x.source==='role_required'?'Necesită Administrator':personalized?'Personalizat':'Implicit rol';
   return `<div class="occ-user-cap-row${locked?' is-locked':''}"><span class="occ-user-cap-icon"><i class="fa-solid ${esc(x.icon)}"></i></span><span class="occ-user-cap-copy"><strong>${esc(x.label)}</strong><small>${esc(x.description)}</small><em class="is-${esc(x.source)}">${esc(sourceLabel)}</em></span><div class="occ-user-cap-actions">${personalized&&!owner?`<button class="occ-reset-cap" data-reset-cap="${esc(x.capability)}" title="Revino la setarea rolului"><i class="fa-solid fa-arrow-rotate-left"></i></button>`:''}<label class="occ-switch"><input type="checkbox" data-user-cap="${esc(x.capability)}" ${x.enabled?'checked':''} ${locked?'disabled':''}><i></i></label></div></div>`;
  }).join('')}</section>`).join('');
 $('#occ-user-capabilities').querySelectorAll('[data-user-cap]').forEach(input=>input.addEventListener('change',()=>setUserCap(profile,input)));
 $('#occ-user-capabilities').querySelectorAll('[data-reset-cap]').forEach(btn=>btn.addEventListener('click',()=>resetUserCap(profile,btn)));
 document.querySelectorAll('[data-template]').forEach(btn=>{btn.disabled=owner;btn.title=owner?'Owner are acces permanent':'';});
}

async function setUserCap(profile,input){
 if(busy)return;busy=true;const next=input.checked;input.disabled=true;
 const {error}=await supabase.rpc('owner_set_user_capability',{p_user_id:profile.id,p_capability:input.dataset.userCap,p_enabled:next,p_inherit:false});
 if(error){input.checked=!next;toast(error.message?.includes('Administrator role')?'Acest modul necesită rol Administrator.':'Accesul individual nu a putut fi actualizat.',true);}else toast(next?'Modul activat pentru utilizator.':'Modul dezactivat pentru utilizator.');
 busy=false;await selectUser(profile.id,false);
}
async function resetUserCap(profile,btn){if(busy)return;busy=true;btn.disabled=true;const {error}=await supabase.rpc('owner_set_user_capability',{p_user_id:profile.id,p_capability:btn.dataset.resetCap,p_enabled:false,p_inherit:true});busy=false;if(error)toast('Nu am putut reveni la setarea rolului.',true);else toast('Modulul moștenește din nou setarea rolului.');await selectUser(profile.id,false);}

async function applyTemplate(template){
 const p=profiles.find(x=>x.id===selectedUserId);if(!p||p.is_owner||busy)return;
 const names={role_default:'Implicit rol',field:'Teren',office:'Office',fleet:'Fleet',restricted:'Minimal'};
 if(!confirm(`Aplic profilul „${names[template]||template}” pentru ${p.full_name}? Poți ajusta apoi fiecare modul individual.`))return;
 busy=true;document.querySelectorAll('[data-template]').forEach(b=>b.disabled=true);
 const {error}=await supabase.rpc('owner_apply_user_access_template',{p_user_id:p.id,p_template:template});busy=false;
 if(error)toast('Profilul de acces nu a putut fi aplicat.',true);else toast(`Profilul „${names[template]}” a fost aplicat.`);
 await selectUser(p.id,false);
}

function bind(){
 $('#occ-refresh')?.addEventListener('click',()=>load().catch(e=>{console.error(e);toast('Sincronizarea a eșuat.',true);}));
 $('#occ-user-search')?.addEventListener('input',e=>renderUsers(e.target.value));
 document.querySelectorAll('[data-template]').forEach(btn=>btn.addEventListener('click',()=>applyTemplate(btn.dataset.template)));
}

(async()=>{const ctx=await requireStaffContext({adminOnly:true});if(!ctx)return;if(!isOwnerProfile(ctx.profile)){location.replace('dashboard.html');return;}$('#occ-user').textContent=ctx.profile.full_name||'Owner BCB';bind();await load();})().catch(e=>{console.error('Owner Command Center:',e);const b=$('#occ-refresh');if(b)b.disabled=false;toast('Command Center nu a putut fi încărcat complet.',true);});
