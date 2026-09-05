import { requireStaffContext, bindAdminLogout, isAdminProfile, isOwnerProfile } from "./admin-session.js";
import { supabase } from "./supabase-client.js";

import("./legal-footer.js").catch(error=>console.error("BCB legal footer error:",error));
import("./pwa-init.js").catch(error=>console.error("BCB PWA init error:",error));

const NAV_GROUPS = [
  {key:"workspace",label:"Workspace",items:[
    { href:"dashboard.html", icon:"fa-grid-2", label:"Dashboard", match:["dashboard.html"] },
    { href:"dashboard.html#projects", icon:"fa-building", label:"Proiecte", match:["project.html","journal.html"], hash:"projects", capability:"projects.work" },
    { href:"time.html", icon:"fa-user-clock", label:"Pontaj & Teren", match:["time.html"], capability:"time.work" },
    { href:"quotes.html", icon:"fa-chart-line", label:"CRM & Oferte", match:["quotes.html"], capability:"crm.work" }
  ]},
  {key:"operations",label:"Operațiuni",items:[
    { href:"fleet.html", icon:"fa-car-side", label:"Fleet", match:["fleet.html"], capability:"fleet.work" },
    { href:"media.html", icon:"fa-images", label:"Media", match:["media.html"], capability:"media.work" },
    { href:"activity.html", icon:"fa-clock-rotate-left", label:"Activitate", match:["activity.html"], capability:"activity.view" }
  ]}
];

const ADMIN_GROUP = {key:"administration",label:"Administrare",adminOnly:true,items:[
  { href:"employees.html", icon:"fa-users-gear", label:"Angajați", match:["employees.html"], capability:"employees.manage" },
  { href:"users.html", icon:"fa-user-shield", label:"Utilizatori", match:["users.html"], capability:"users.manage" },
  { href:"site-editor.html", icon:"fa-pen-ruler", label:"Site Editor", match:["site-editor.html"], capability:"site.manage" },
  { href:"settings.html", icon:"fa-sliders", label:"Setări site", match:["settings.html"], capability:"site.manage" },
  { href:"data-control.html", icon:"fa-database", label:"Control date", match:["data-control.html"], capability:"data.manage" }
]};

const OWNER_GROUP = {key:"owner",label:"Owner Control",adminOnly:true,ownerOnly:true,items:[
  { href:"owner-command-center.html", icon:"fa-crown", label:"Command Center", match:["owner-command-center.html"] },
  { href:"security-center.html", icon:"fa-shield-halved", label:"Security Center", match:["security-center.html"] }
]};

const PAGE_CAPABILITY = {
  "project.html":"projects.work","journal.html":"projects.work","time.html":"time.work","quotes.html":"crm.work",
  "fleet.html":"fleet.work","media.html":"media.work","activity.html":"activity.view","employees.html":"employees.manage",
  "users.html":"users.manage","site-editor.html":"site.manage","settings.html":"site.manage","data-control.html":"data.manage"
};

let effectiveCaps=null;
let capabilityChannel=null;
let capabilityPollTimer=null;
let capabilityRefreshTimer=null;
let capabilityRefreshBusy=false;
let capabilityContext=null;

function currentPage(){return window.location.pathname.split("/").pop()||"dashboard.html";}
function hasCap(capability,profile){return !capability||isOwnerProfile(profile)||effectiveCaps?.has(capability);}

async function loadCapabilities(profile){
  if(isOwnerProfile(profile)){effectiveCaps=new Set(["*"]);window.__BCB_EFFECTIVE_CAPABILITIES__=effectiveCaps;return true;}
  try{
    const {data,error}=await supabase.rpc("get_effective_user_capabilities",{p_user_id:profile.id});
    if(error)throw error;
    effectiveCaps=new Set((data||[]).filter(x=>x.enabled).map(x=>x.capability));
    window.__BCB_EFFECTIVE_CAPABILITIES__=effectiveCaps;
    return true;
  }catch(error){
    console.error("BCB capability sync:",error);
    effectiveCaps=null;
    return false;
  }
}

function isActive(item){
  const page=currentPage(),hash=window.location.hash.replace("#","");
  if(page==="dashboard.html"){
    if(item.hash)return hash===item.hash;
    if(item.href==="dashboard.html")return !hash;
  }
  return Boolean(item.match?.includes(page));
}

function makeLink(item,adminOnly=false){
  const a=document.createElement("a");a.href=item.href;a.dataset.bcbNav="true";a.dataset.navLabel=item.label;a.title=item.label;
  if(adminOnly)a.dataset.adminOnly="true";a.setAttribute("aria-label",item.label);
  a.innerHTML=`<span class="bcb-nav-icon"><i class="fa-solid ${item.icon}" aria-hidden="true"></i></span><span class="bcb-nav-label">${item.label}</span>`;
  a.classList.toggle("active",isActive(item));if(isActive(item))a.setAttribute("aria-current","page");return a;
}

function makeGroup(group,profile,legacy=false){
  const visible=group.items.filter(item=>legacy?(!group.adminOnly||isAdminProfile(profile)):hasCap(item.capability,profile));
  if(!visible.length)return null;
  const section=document.createElement("section");section.className=`bcb-nav-group bcb-nav-group-${group.key}`;section.dataset.navGroup=group.key;
  const heading=document.createElement("div");heading.className="bcb-nav-group-title";heading.textContent=group.label;section.appendChild(heading);
  const links=document.createElement("div");links.className="bcb-nav-group-links";visible.forEach(item=>links.appendChild(makeLink(item,Boolean(group.adminOnly))));section.appendChild(links);return section;
}

function renderNavigation(profile,legacy=false){
  const nav=document.querySelector(".bcb-admin-nav");if(!nav)return;
  const groups=[...NAV_GROUPS,ADMIN_GROUP];if(isOwnerProfile(profile))groups.push(OWNER_GROUP);
  const fragment=document.createDocumentFragment();groups.forEach(group=>{const el=makeGroup(group,profile,legacy);if(el)fragment.appendChild(el);});
  nav.replaceChildren(fragment);nav.setAttribute("aria-label","Navigare Business Manager");
  if(!nav.dataset.hashSync){nav.dataset.hashSync="true";window.addEventListener("hashchange",()=>renderNavigation(profile,!effectiveCaps),{passive:true});}
}

function enforcePageAccess(profile,capabilitiesLoaded){
  if(isOwnerProfile(profile)||!capabilitiesLoaded)return true;
  const required=PAGE_CAPABILITY[currentPage()];if(!required||hasCap(required,profile))return true;
  window.location.replace("dashboard.html?access=restricted");return false;
}

function setVisible(el,visible){if(!el)return;el.hidden=!visible;el.setAttribute('aria-hidden',String(!visible));}
function syncDashboardSurfaces(profile){
  if(currentPage()!=="dashboard.html"||isOwnerProfile(profile))return;
  const projects=hasCap('projects.work',profile),crm=hasCap('crm.work',profile),media=hasCap('media.work',profile);
  setVisible(document.querySelector('#projects'),projects);
  setVisible(document.querySelector('.bcb-dashboard-crm'),crm);
  setVisible(document.querySelector('#bcb-admin-projects-count')?.closest('article'),projects);
  setVisible(document.querySelector('#bcb-admin-active-count')?.closest('article'),projects);
  setVisible(document.querySelector('#bcb-admin-completed-count')?.closest('article'),projects);
  setVisible(document.querySelector('#bcb-admin-media-count')?.closest('article'),media);
  const newProject=document.querySelector('.bcb-admin-primary-action');if(newProject&&!projects)newProject.hidden=true;
  if(location.hash==="#projects"&&!projects)history.replaceState(null,"",location.pathname+location.search);
}

function emitCapabilitiesUpdated(profile){
  window.dispatchEvent(new CustomEvent('bcb:capabilities-updated',{detail:{profileId:profile.id,capabilities:effectiveCaps?Array.from(effectiveCaps):null}}));
}

async function refreshEffectiveAccess(reason='sync'){
  if(!capabilityContext||isOwnerProfile(capabilityContext.profile)||capabilityRefreshBusy)return;
  capabilityRefreshBusy=true;
  try{
    const ok=await loadCapabilities(capabilityContext.profile);
    if(!ok)return;
    if(!enforcePageAccess(capabilityContext.profile,true))return;
    renderNavigation(capabilityContext.profile,false);
    syncDashboardSurfaces(capabilityContext.profile);
    emitCapabilitiesUpdated(capabilityContext.profile);
  }catch(error){console.error(`BCB capability refresh (${reason}):`,error);}
  finally{capabilityRefreshBusy=false;}
}

function scheduleCapabilityRefresh(reason='realtime'){
  clearTimeout(capabilityRefreshTimer);
  capabilityRefreshTimer=setTimeout(()=>refreshEffectiveAccess(reason),120);
}

function setupCapabilitySync(context){
  capabilityContext=context;
  if(isOwnerProfile(context.profile))return;
  if(capabilityChannel){supabase.removeChannel(capabilityChannel);capabilityChannel=null;}
  capabilityChannel=supabase.channel(`bcb-access-${context.profile.id}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'user_capability_overrides',filter:`user_id=eq.${context.profile.id}`},()=>scheduleCapabilityRefresh('user-override'))
    .on('postgres_changes',{event:'*',schema:'public',table:'role_capabilities',filter:`role=eq.${context.profile.role}`},()=>scheduleCapabilityRefresh('role-default'))
    .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('BCB access realtime:',status);});
  clearInterval(capabilityPollTimer);capabilityPollTimer=setInterval(()=>refreshEffectiveAccess('fallback-poll'),60000);
  window.addEventListener('focus',()=>refreshEffectiveAccess('window-focus'),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshEffectiveAccess('visibility');});
}

function syncRoleLabel(profile){document.querySelectorAll('.bcb-admin-user-card').forEach(card=>{const label=card.querySelector('span');const desired=isOwnerProfile(profile)?'Owner':profile?.role==='admin'?'Administrator':'Editor';if(label&&label.textContent!==desired)label.textContent=desired;card.classList.toggle('is-owner',isOwnerProfile(profile));if(isOwnerProfile(profile)&&label&&!label.dataset.ownerWatch){label.dataset.ownerWatch='true';new MutationObserver(()=>{if(label.textContent!=='Owner')label.textContent='Owner';}).observe(label,{childList:true,characterData:true,subtree:true});}});}

function setupMobileDrawer(){
  const sidebar=document.querySelector(".bcb-admin-sidebar");if(!sidebar||document.querySelector(".bcb-mobile-admin-bar"))return;
  const bar=document.createElement("div");bar.className="bcb-mobile-admin-bar";bar.innerHTML=`<div class="bcb-mobile-admin-brand"><img src="../assets/images/logo.png" alt="BCB Group"><span><small>BCB Group</small><strong>Business Manager</strong></span></div><button class="bcb-mobile-admin-menu" type="button" aria-label="Deschide meniul" aria-expanded="false"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>`;
  const overlay=document.createElement("div");overlay.className="bcb-mobile-admin-overlay";overlay.setAttribute("aria-hidden","true");document.body.append(bar,overlay);
  const button=bar.querySelector(".bcb-mobile-admin-menu"),icon=button.querySelector("i");let opened=false,lastFocus=null;
  const setOpen=next=>{if(opened===next)return;opened=next;if(next)lastFocus=document.activeElement;sidebar.classList.toggle("is-mobile-open",next);overlay.classList.toggle("is-open",next);overlay.setAttribute("aria-hidden",String(!next));button.setAttribute("aria-expanded",String(next));button.setAttribute("aria-label",next?"Închide meniul":"Deschide meniul");icon.className=next?"fa-solid fa-xmark":"fa-solid fa-bars";document.body.classList.toggle("bcb-mobile-nav-open",next);if(next)requestAnimationFrame(()=>sidebar.querySelector('.bcb-admin-nav a')?.focus({preventScroll:true}));else if(lastFocus instanceof HTMLElement)lastFocus.focus({preventScroll:true});};
  button.addEventListener("click",()=>setOpen(!opened));overlay.addEventListener("click",()=>setOpen(false));sidebar.addEventListener("click",e=>{if(e.target.closest("a"))setOpen(false)});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&opened)setOpen(false)});window.addEventListener("resize",()=>{if(window.innerWidth>720&&opened)setOpen(false)},{passive:true});
}

function ensureStyles(href,key){if(document.querySelector(`link[data-${key}]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.setAttribute(`data-${key}`,'true');document.head.appendChild(link);}

async function syncAdminNavigation(){
  setupMobileDrawer();bindAdminLogout();ensureStyles('../css/admin-owner.css','owner-styles');const context=await requireStaffContext();if(!context)return;
  const capsLoaded=await loadCapabilities(context.profile);if(!enforcePageAccess(context.profile,capsLoaded))return;renderNavigation(context.profile,!capsLoaded);syncRoleLabel(context.profile);syncDashboardSurfaces(context.profile);setupCapabilitySync(context);
  ensureStyles('../css/admin-notification-center.css','notification-center-styles');import('./admin-notification-center.js').then(m=>m.initNotificationCenter()).catch(error=>console.error('BCB notifications:',error));
  ensureStyles('../css/admin-copilot.css','copilot-styles');ensureStyles('../css/admin-copilot-hybrid.css','copilot-hybrid-styles');ensureStyles('../css/admin-copilot-mobile-controls.css','copilot-mobile-controls-styles');ensureStyles('../css/admin-time.css','time-global-styles');
  import('./admin-copilot.js').catch(error=>console.error('BCB AI Copilot:',error));import('./admin-copilot-mobile-controls.js').catch(error=>console.error('BCB AI mobile controls:',error));import('./admin-workday-status.js').catch(error=>console.error('BCB workday status:',error));import('./admin-profile.js').then(m=>m.initAdminProfile()).catch(error=>console.error('BCB profile manager:',error));
  if(currentPage()==='users.html')import('./admin-user-avatars.js').catch(error=>console.error('BCB user avatars:',error));
  if(currentPage()==='time.html'){ensureStyles('../css/admin-field-reports.css','field-report-styles');import('./admin-field-reports.js').catch(error=>console.error('BCB field daily reports:',error));import('./admin-field-report-stop-bridge.js').catch(error=>console.error('BCB field report stop bridge:',error));}
  if(currentPage()==='project.html'){ensureStyles('../css/admin-project-field-intelligence.css','project-field-intelligence-styles');ensureStyles('../css/admin-project-command-center.css','project-command-center-styles');import('./admin-project-field-intelligence.js').catch(error=>console.error('BCB project field intelligence:',error));import('./admin-project-command-center.js').catch(error=>console.error('BCB project command center:',error));if(isAdminProfile(context.profile)){ensureStyles('../css/admin-project-labor.css','project-labor-styles');import('./admin-project-labor.js').catch(error=>console.error('BCB project labor:',error));}}
  if(currentPage()==="fleet.html"){ensureStyles('../css/admin-fleet-safety.css','fleet-safety-styles');ensureStyles('../css/admin-fleet-fuel-stop.css','fleet-fuel-stop-styles');import("./admin-fleet-safety.js").catch(error=>console.error("Fleet safety controls:",error));if(isAdminProfile(context.profile)&&hasCap('fleet.correct',context.profile)){ensureStyles('../css/admin-fleet-trip-corrections.css','fleet-trip-correction-styles');import("./admin-fleet-delete.js").catch(error=>console.error("Fleet delete controls:",error));import("./admin-fleet-trip-corrections.js").catch(error=>console.error("Fleet trip corrections:",error));}}
}
syncAdminNavigation();
