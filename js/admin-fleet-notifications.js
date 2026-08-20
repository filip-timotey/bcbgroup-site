import { requireStaff, supabase, esc, fmtDate } from "./admin-common.js";

let ctx=null;
let timer=null;
const $=(s)=>document.querySelector(s);
const isAdmin=()=>Boolean(ctx?.profile?.is_owner||ctx?.profile?.role==="admin");
const elapsedMinutes=(start)=>Math.max(0,Math.floor((Date.now()-new Date(start).getTime())/60000));
const durationLabel=(minutes)=>minutes<60?`${minutes} min`:`${Math.floor(minutes/60)} h ${minutes%60} min`;

async function loadState(){
  if(!ctx)return;
  const [{data:trip},{data:settings}]=await Promise.all([
    supabase.from("fleet_trips").select("id,vehicle_id,start_at,origin,destination,purpose,status").eq("driver_id",ctx.session.user.id).eq("status","active").maybeSingle(),
    supabase.from("fleet_settings").select("active_trip_alerts_enabled,active_trip_threshold_minutes,active_trip_repeat_minutes,active_trip_notify_driver,active_trip_notify_admin").eq("id",true).maybeSingle()
  ]);
  renderTripMonitor(trip,settings||{});
  if(isAdmin())renderAdminSettings(settings||{});
}

function renderTripMonitor(trip,settings){
  let root=$("#fleet-active-notification-monitor");
  if(!root){
    root=document.createElement("div");
    root.id="fleet-active-notification-monitor";
    $("[data-fleet-panel='today']")?.prepend(root);
  }
  if(!trip){root.innerHTML="";return;}
  const mins=elapsedMinutes(trip.start_at);
  const threshold=Number(settings.active_trip_threshold_minutes||180);
  const attention=mins>=threshold;
  root.innerHTML=`<aside class="fleet-trip-monitor ${attention?"is-due":""}"><div class="fleet-trip-monitor-icon"><i class="fa-solid fa-bell"></i></div><div><span>${attention?"REMINDER ACTIV":"MONITORIZARE ACTIVĂ"}</span><strong>Cursa rulează de ${esc(durationLabel(mins))}</strong><small>Start ${esc(fmtDate(trip.start_at))}. ${attention?"Dacă ai ajuns, încheie cursa pentru a păstra foaia de parcurs corectă.":`Reminder automat după ${esc(durationLabel(threshold))}.`}</small></div><button type="button" id="fleet-enable-device-notifications"><i class="fa-solid fa-mobile-screen-button"></i> Notificări dispozitiv</button></aside>`;
  $("#fleet-enable-device-notifications")?.addEventListener("click",requestDeviceNotifications);
  scheduleLocalReminder(trip,threshold);
}

async function requestDeviceNotifications(){
  if(!("Notification" in window)){alert("Acest browser nu oferă notificări locale.");return;}
  const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
  if(permission!=="granted"){alert("Notificările nu au fost permise pentru acest dispozitiv.");return;}
  localStorage.setItem("bcb-fleet-device-notifications","enabled");
  new Notification("BCB Fleet",{body:"Notificările pentru curse active sunt activate.",icon:"../assets/images/logo.png"});
}

function scheduleLocalReminder(trip,threshold){
  if(timer)clearInterval(timer);
  const check=()=>{
    if(localStorage.getItem("bcb-fleet-device-notifications")!=="enabled"||Notification.permission!=="granted")return;
    const mins=elapsedMinutes(trip.start_at);
    if(mins<threshold)return;
    const key=`bcb-fleet-reminder-${trip.id}`;
    const last=Number(localStorage.getItem(key)||0);
    if(Date.now()-last<60*60000)return;
    const body=`Cursa este activă de ${durationLabel(mins)}. Dacă ai ajuns, deschide Fleet și apasă STOP CURSĂ.`;
    if(navigator.serviceWorker?.controller){navigator.serviceWorker.ready.then(reg=>reg.showNotification("BCB Fleet · Cursă activă",{body,icon:"../assets/images/logo.png",badge:"../assets/images/logo.png",tag:`fleet-${trip.id}`,data:{url:"/admin/fleet.html"}})).catch(()=>new Notification("BCB Fleet · Cursă activă",{body}));}
    else new Notification("BCB Fleet · Cursă activă",{body});
    localStorage.setItem(key,String(Date.now()));
  };
  check();
  timer=setInterval(check,60000);
}

function renderAdminSettings(settings){
  const form=$("#fleet-settings-form");
  if(!form||$("#fleet-active-alert-settings"))return;
  const box=document.createElement("fieldset");
  box.id="fleet-active-alert-settings";
  box.className="fleet-notification-settings";
  box.innerHTML=`<legend><i class="fa-solid fa-bell"></i> Active Trip Notifications</legend><label><span>Monitorizare curse active</span><input id="fleet-active-alerts-enabled" type="checkbox" ${settings.active_trip_alerts_enabled!==false?"checked":""}></label><label>Primul reminder după (minute)<input id="fleet-active-alert-threshold" type="number" min="30" max="1440" step="15" value="${Number(settings.active_trip_threshold_minutes||180)}"></label><label>Repetă la (minute)<input id="fleet-active-alert-repeat" type="number" min="30" max="1440" step="15" value="${Number(settings.active_trip_repeat_minutes||120)}"></label><label><span>Email către șofer</span><input id="fleet-active-alert-driver" type="checkbox" ${settings.active_trip_notify_driver!==false?"checked":""}></label><label><span>Email către administrare</span><input id="fleet-active-alert-admin" type="checkbox" ${settings.active_trip_notify_admin!==false?"checked":""}></label><button type="button" id="fleet-test-active-alerts" class="fleet-admin-action"><i class="fa-solid fa-paper-plane"></i> Rulează verificarea acum</button>`;
  form.insertBefore(box,form.querySelector("button[type='submit']"));
  form.addEventListener("submit",saveNotificationSettings,true);
  $("#fleet-test-active-alerts")?.addEventListener("click",testAlerts);
}

async function saveNotificationSettings(event){
  if(!isAdmin())return;
  const threshold=Number($("#fleet-active-alert-threshold")?.value||180);
  const repeat=Number($("#fleet-active-alert-repeat")?.value||120);
  if(threshold<30||threshold>1440||repeat<30||repeat>1440){event.preventDefault();event.stopImmediatePropagation();alert("Intervalele pentru notificări trebuie să fie între 30 și 1440 minute.");return;}
  const {error}=await supabase.from("fleet_settings").update({active_trip_alerts_enabled:$("#fleet-active-alerts-enabled")?.checked??true,active_trip_threshold_minutes:threshold,active_trip_repeat_minutes:repeat,active_trip_notify_driver:$("#fleet-active-alert-driver")?.checked??true,active_trip_notify_admin:$("#fleet-active-alert-admin")?.checked??true}).eq("id",true);
  if(error){event.preventDefault();event.stopImmediatePropagation();alert(`Setările notificărilor nu au putut fi salvate: ${error.message}`);}
}

async function testAlerts(){
  if(!isAdmin())return;
  const btn=$("#fleet-test-active-alerts");btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Se verifică…';
  try{const {data,error}=await supabase.functions.invoke("send-fleet-active-trip-alerts",{body:{source:"manual"}});if(error)throw error;alert(`Verificare finalizată. Notificări trimise: ${Number(data?.sent||0)}.`);}catch(error){alert(`Verificarea nu a putut fi rulată: ${error.message||error}`);}finally{btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Rulează verificarea acum';}
}

(async()=>{ctx=await requireStaff();if(!ctx)return;await loadState();})();
