import { requireStaffContext, bindAdminLogout, isAdminProfile, isOwnerProfile } from "./admin-session.js";

import("./legal-footer.js").catch(error=>console.error("BCB legal footer error:",error));
import("./pwa-init.js").catch(error=>console.error("BCB PWA init error:",error));

const COMMON_NAV = [
  { href:"dashboard.html", icon:"fa-grid-2", label:"Dashboard", match:["dashboard.html"] },
  { href:"dashboard.html#projects", icon:"fa-building", label:"Proiecte", match:["project.html","journal.html"], hash:"projects" },
  { href:"quotes.html", icon:"fa-chart-line", label:"CRM & Oferte", match:["quotes.html"] },
  { href:"media.html", icon:"fa-images", label:"Media", match:["media.html"] },
  { href:"activity.html", icon:"fa-clock-rotate-left", label:"Activitate", match:["activity.html"] },
  { href:"fleet.html", icon:"fa-car-side", label:"Fleet", match:["fleet.html"] }
];

const ADMIN_NAV = [
  { href:"employees.html", icon:"fa-users-gear", label:"Angajați", match:["employees.html"] },
  { href:"site-editor.html", icon:"fa-pen-ruler", label:"Site Editor", match:["site-editor.html"] },
  { href:"settings.html", icon:"fa-sliders", label:"Setări site", match:["settings.html"] },
  { href:"data-control.html", icon:"fa-database", label:"Control date", match:["data-control.html"] },
  { href:"users.html", icon:"fa-user-shield", label:"Utilizatori", match:["users.html"] }
];

function currentPage(){ return window.location.pathname.split("/").pop() || "dashboard.html"; }
function makeLink(item, adminOnly=false){const a=document.createElement("a");a.href=item.href;a.dataset.bcbNav="true";if(adminOnly)a.dataset.adminOnly="true";a.innerHTML=`<i class="fa-solid ${item.icon}"></i> ${item.label}`;return a;}
function isActive(item){const page=currentPage();if(item.match?.includes(page))return true;if(page==="dashboard.html"&&item.hash&&window.location.hash.replace("#","")===item.hash)return true;if(page==="dashboard.html"&&item.href==="dashboard.html"&&!window.location.hash)return true;return false;}
function renderNavigation(profile){const nav=document.querySelector(".bcb-admin-nav");if(!nav)return;const isAdmin=isAdminProfile(profile);const fragment=document.createDocumentFragment();[...COMMON_NAV,...(isAdmin?ADMIN_NAV:[])].forEach(item=>{const link=makeLink(item,ADMIN_NAV.includes(item));link.classList.toggle("active",isActive(item));fragment.appendChild(link);});nav.replaceChildren(fragment);if(!nav.dataset.hashSync){nav.dataset.hashSync="true";window.addEventListener("hashchange",()=>renderNavigation(profile),{passive:true});}}
function syncRoleLabel(profile){const cards=document.querySelectorAll('.bcb-admin-user-card');cards.forEach(card=>{const label=card.querySelector('span');const desired=isOwnerProfile(profile)?'Owner':profile?.role==='admin'?'Administrator':'Editor';if(label&&label.textContent!==desired)label.textContent=desired;card.classList.toggle('is-owner',isOwnerProfile(profile));if(isOwnerProfile(profile)&&label&&!label.dataset.ownerWatch){label.dataset.ownerWatch='true';const observer=new MutationObserver(()=>{if(label.textContent!=='Owner')label.textContent='Owner';});observer.observe(label,{childList:true,characterData:true,subtree:true});}});}
function setupMobileDrawer(){const sidebar=document.querySelector(".bcb-admin-sidebar");if(!sidebar||document.querySelector(".bcb-mobile-admin-bar"))return;const bar=document.createElement("div");bar.className="bcb-mobile-admin-bar";bar.innerHTML=`<div class="bcb-mobile-admin-brand"><img src="../assets/images/logo.png" alt="BCB Group"><span><small>BCB Group</small><strong>Business Manager</strong></span></div><button class="bcb-mobile-admin-menu" type="button" aria-label="Deschide meniul" aria-expanded="false"><i class="fa-solid fa-bars"></i></button>`;const overlay=document.createElement("div");overlay.className="bcb-mobile-admin-overlay";document.body.append(bar,overlay);const button=bar.querySelector(".bcb-mobile-admin-menu"),icon=button.querySelector("i");let opened=false;const setOpen=next=>{if(opened===next)return;opened=next;sidebar.classList.toggle("is-mobile-open",next);overlay.classList.toggle("is-open",next);button.setAttribute("aria-expanded",String(next));icon.className=next?"fa-solid fa-xmark":"fa-solid fa-bars";document.body.style.overflow=next?"hidden":"";};button.addEventListener("click",()=>setOpen(!opened));overlay.addEventListener("click",()=>setOpen(false));sidebar.addEventListener("click",e=>{if(e.target.closest("a"))setOpen(false)});document.addEventListener("keydown",e=>{if(e.key==="Escape")setOpen(false)});window.addEventListener("resize",()=>{if(window.innerWidth>620)setOpen(false)},{passive:true});}
function ensureStyles(href,key){if(document.querySelector(`link[data-${key}]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.setAttribute(`data-${key}`,'true');document.head.appendChild(link);}

async function syncAdminNavigation(){
  setupMobileDrawer(); bindAdminLogout(); ensureStyles('../css/admin-owner.css','owner-styles');
  const context=await requireStaffContext(); if(!context)return;
  renderNavigation(context.profile); syncRoleLabel(context.profile);
  ensureStyles('../css/admin-copilot.css','copilot-styles');
  ensureStyles('../css/admin-copilot-hybrid.css','copilot-hybrid-styles');
  import('./admin-copilot.js').catch(error=>console.error('BCB AI Copilot:',error));
  import('./admin-profile.js').then(m=>m.initAdminProfile()).catch(error=>console.error('BCB profile manager:',error));
  if(currentPage()==='users.html') import('./admin-user-avatars.js').catch(error=>console.error('BCB user avatars:',error));
  if(currentPage()==="fleet.html"){
    ensureStyles('../css/admin-fleet-safety.css','fleet-safety-styles');
    import("./admin-fleet-safety.js").catch(error=>console.error("Fleet safety controls:",error));
    if(isAdminProfile(context.profile))import("./admin-fleet-delete.js").catch(error=>console.error("Fleet delete controls:",error));
  }
}
syncAdminNavigation();
