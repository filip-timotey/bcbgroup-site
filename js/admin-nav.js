import { requireStaffContext, bindAdminLogout, isAdminProfile, isOwnerProfile } from "./admin-session.js";

import("./legal-footer.js").catch(error=>console.error("BCB legal footer error:",error));
import("./pwa-init.js").catch(error=>console.error("BCB PWA init error:",error));

const NAV_GROUPS = [
  {
    key:"workspace",
    label:"Workspace",
    items:[
      { href:"dashboard.html", icon:"fa-grid-2", label:"Dashboard", match:["dashboard.html"] },
      { href:"dashboard.html#projects", icon:"fa-building", label:"Proiecte", match:["project.html","journal.html"], hash:"projects" },
      { href:"time.html", icon:"fa-user-clock", label:"Pontaj & Teren", match:["time.html"] },
      { href:"quotes.html", icon:"fa-chart-line", label:"CRM & Oferte", match:["quotes.html"] }
    ]
  },
  {
    key:"operations",
    label:"Operațiuni",
    items:[
      { href:"fleet.html", icon:"fa-car-side", label:"Fleet", match:["fleet.html"] },
      { href:"media.html", icon:"fa-images", label:"Media", match:["media.html"] },
      { href:"activity.html", icon:"fa-clock-rotate-left", label:"Activitate", match:["activity.html"] }
    ]
  }
];

const ADMIN_GROUP = {
  key:"administration",
  label:"Administrare",
  adminOnly:true,
  items:[
    { href:"employees.html", icon:"fa-users-gear", label:"Angajați", match:["employees.html"] },
    { href:"users.html", icon:"fa-user-shield", label:"Utilizatori", match:["users.html"] },
    { href:"site-editor.html", icon:"fa-pen-ruler", label:"Site Editor", match:["site-editor.html"] },
    { href:"settings.html", icon:"fa-sliders", label:"Setări site", match:["settings.html"] },
    { href:"data-control.html", icon:"fa-database", label:"Control date", match:["data-control.html"] }
  ]
};

const OWNER_GROUP = {
  key:"owner",
  label:"Owner Control",
  adminOnly:true,
  ownerOnly:true,
  items:[
    { href:"owner-command-center.html", icon:"fa-crown", label:"Command Center", match:["owner-command-center.html"] },
    { href:"security-center.html", icon:"fa-shield-halved", label:"Security Center", match:["security-center.html"] }
  ]
};

function currentPage(){return window.location.pathname.split("/").pop()||"dashboard.html";}

function isActive(item){
  const page=currentPage();
  const hash=window.location.hash.replace("#","");
  if(page==="dashboard.html"){
    if(item.hash)return hash===item.hash;
    if(item.href==="dashboard.html")return !hash;
  }
  return Boolean(item.match?.includes(page));
}

function makeLink(item,adminOnly=false){
  const a=document.createElement("a");
  a.href=item.href;
  a.dataset.bcbNav="true";
  a.dataset.navLabel=item.label;
  a.title=item.label;
  if(adminOnly)a.dataset.adminOnly="true";
  a.setAttribute("aria-label",item.label);
  a.innerHTML=`<span class="bcb-nav-icon"><i class="fa-solid ${item.icon}" aria-hidden="true"></i></span><span class="bcb-nav-label">${item.label}</span>`;
  a.classList.toggle("active",isActive(item));
  if(isActive(item))a.setAttribute("aria-current","page");
  return a;
}

function makeGroup(group){
  const section=document.createElement("section");
  section.className=`bcb-nav-group bcb-nav-group-${group.key}`;
  section.dataset.navGroup=group.key;
  const heading=document.createElement("div");
  heading.className="bcb-nav-group-title";
  heading.textContent=group.label;
  section.appendChild(heading);
  const links=document.createElement("div");
  links.className="bcb-nav-group-links";
  group.items.forEach(item=>links.appendChild(makeLink(item,Boolean(group.adminOnly))));
  section.appendChild(links);
  return section;
}

function renderNavigation(profile){
  const nav=document.querySelector(".bcb-admin-nav");
  if(!nav)return;
  const admin=isAdminProfile(profile),owner=isOwnerProfile(profile);
  const groups=[...NAV_GROUPS];
  if(admin)groups.push(ADMIN_GROUP);
  if(owner)groups.push(OWNER_GROUP);
  const fragment=document.createDocumentFragment();
  groups.forEach(group=>fragment.appendChild(makeGroup(group)));
  nav.replaceChildren(fragment);
  nav.setAttribute("aria-label","Navigare Business Manager");
  if(!nav.dataset.hashSync){
    nav.dataset.hashSync="true";
    window.addEventListener("hashchange",()=>renderNavigation(profile),{passive:true});
  }
}

function syncRoleLabel(profile){document.querySelectorAll('.bcb-admin-user-card').forEach(card=>{const label=card.querySelector('span');const desired=isOwnerProfile(profile)?'Owner':profile?.role==='admin'?'Administrator':'Editor';if(label&&label.textContent!==desired)label.textContent=desired;card.classList.toggle('is-owner',isOwnerProfile(profile));if(isOwnerProfile(profile)&&label&&!label.dataset.ownerWatch){label.dataset.ownerWatch='true';new MutationObserver(()=>{if(label.textContent!=='Owner')label.textContent='Owner';}).observe(label,{childList:true,characterData:true,subtree:true});}});}

function setupMobileDrawer(){
  const sidebar=document.querySelector(".bcb-admin-sidebar");
  if(!sidebar||document.querySelector(".bcb-mobile-admin-bar"))return;
  const bar=document.createElement("div");
  bar.className="bcb-mobile-admin-bar";
  bar.innerHTML=`<div class="bcb-mobile-admin-brand"><img src="../assets/images/logo.png" alt="BCB Group"><span><small>BCB Group</small><strong>Business Manager</strong></span></div><button class="bcb-mobile-admin-menu" type="button" aria-label="Deschide meniul" aria-expanded="false"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>`;
  const overlay=document.createElement("div");
  overlay.className="bcb-mobile-admin-overlay";
  overlay.setAttribute("aria-hidden","true");
  document.body.append(bar,overlay);
  const button=bar.querySelector(".bcb-mobile-admin-menu"),icon=button.querySelector("i");
  let opened=false,lastFocus=null;
  const setOpen=next=>{
    if(opened===next)return;
    opened=next;
    if(next)lastFocus=document.activeElement;
    sidebar.classList.toggle("is-mobile-open",next);
    overlay.classList.toggle("is-open",next);
    overlay.setAttribute("aria-hidden",String(!next));
    button.setAttribute("aria-expanded",String(next));
    button.setAttribute("aria-label",next?"Închide meniul":"Deschide meniul");
    icon.className=next?"fa-solid fa-xmark":"fa-solid fa-bars";
    document.body.classList.toggle("bcb-mobile-nav-open",next);
    if(next)requestAnimationFrame(()=>sidebar.querySelector('.bcb-admin-nav a')?.focus({preventScroll:true}));
    else if(lastFocus instanceof HTMLElement)lastFocus.focus({preventScroll:true});
  };
  button.addEventListener("click",()=>setOpen(!opened));
  overlay.addEventListener("click",()=>setOpen(false));
  sidebar.addEventListener("click",e=>{if(e.target.closest("a"))setOpen(false)});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&opened)setOpen(false)});
  window.addEventListener("resize",()=>{if(window.innerWidth>720&&opened)setOpen(false)},{passive:true});
}

function ensureStyles(href,key){if(document.querySelector(`link[data-${key}]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.setAttribute(`data-${key}`,'true');document.head.appendChild(link);}

async function syncAdminNavigation(){setupMobileDrawer();bindAdminLogout();ensureStyles('../css/admin-owner.css','owner-styles');const context=await requireStaffContext();if(!context)return;renderNavigation(context.profile);syncRoleLabel(context.profile);ensureStyles('../css/admin-notification-center.css','notification-center-styles');import('./admin-notification-center.js').then(m=>m.initNotificationCenter()).catch(error=>console.error('BCB notifications:',error));ensureStyles('../css/admin-copilot.css','copilot-styles');ensureStyles('../css/admin-copilot-hybrid.css','copilot-hybrid-styles');ensureStyles('../css/admin-copilot-mobile-controls.css','copilot-mobile-controls-styles');ensureStyles('../css/admin-time.css','time-global-styles');import('./admin-copilot.js').catch(error=>console.error('BCB AI Copilot:',error));import('./admin-copilot-mobile-controls.js').catch(error=>console.error('BCB AI mobile controls:',error));import('./admin-workday-status.js').catch(error=>console.error('BCB workday status:',error));import('./admin-profile.js').then(m=>m.initAdminProfile()).catch(error=>console.error('BCB profile manager:',error));if(currentPage()==='users.html')import('./admin-user-avatars.js').catch(error=>console.error('BCB user avatars:',error));if(currentPage()==='time.html'){ensureStyles('../css/admin-field-reports.css','field-report-styles');import('./admin-field-reports.js').catch(error=>console.error('BCB field daily reports:',error));import('./admin-field-report-stop-bridge.js').catch(error=>console.error('BCB field report stop bridge:',error));}if(currentPage()==='project.html'){ensureStyles('../css/admin-project-field-intelligence.css','project-field-intelligence-styles');ensureStyles('../css/admin-project-command-center.css','project-command-center-styles');import('./admin-project-field-intelligence.js').catch(error=>console.error('BCB project field intelligence:',error));import('./admin-project-command-center.js').catch(error=>console.error('BCB project command center:',error));if(isAdminProfile(context.profile)){ensureStyles('../css/admin-project-labor.css','project-labor-styles');import('./admin-project-labor.js').catch(error=>console.error('BCB project labor:',error));}}if(currentPage()==="fleet.html"){ensureStyles('../css/admin-fleet-safety.css','fleet-safety-styles');ensureStyles('../css/admin-fleet-fuel-stop.css','fleet-fuel-stop-styles');import("./admin-fleet-safety.js").catch(error=>console.error("Fleet safety controls:",error));if(isAdminProfile(context.profile)){ensureStyles('../css/admin-fleet-trip-corrections.css','fleet-trip-correction-styles');import("./admin-fleet-delete.js").catch(error=>console.error("Fleet delete controls:",error));import("./admin-fleet-trip-corrections.js").catch(error=>console.error("Fleet trip corrections:",error));}}}
syncAdminNavigation();
