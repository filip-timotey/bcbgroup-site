const CACHE='bcb-manager-shell-v4';
const SHELL=[
  '/admin/index.html','/admin/dashboard.html','/admin/fleet.html','/admin/employees.html','/admin/quotes.html','/admin/time.html',
  '/css/style.css','/css/admin-2026.css','/css/admin-nav.css','/css/admin-business.css','/css/admin-crm.css','/css/admin-copilot.css','/css/admin-fleet-notifications.css','/css/admin-time.css',
  '/assets/images/logo.png','/manifest.webmanifest'
];

self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL).catch(()=>{})));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('bcb-manager-shell-')).map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==location.origin)return;if(req.mode==='navigate'){event.respondWith((async()=>{try{const fresh=await fetch(req);const cache=await caches.open(CACHE);cache.put(req,fresh.clone()).catch(()=>{});return fresh;}catch{return (await caches.match(req))||(await caches.match('/admin/index.html'));}})());return;}if(/\.(?:css|js)$/i.test(url.pathname)){event.respondWith((async()=>{try{const fresh=await fetch(req,{cache:'no-store'});if(fresh.ok){const cache=await caches.open(CACHE);cache.put(req,fresh.clone()).catch(()=>{});}return fresh;}catch{return (await caches.match(req))||Response.error();}})());return;}if(/\.(?:png|jpg|jpeg|webp|svg|woff2?)$/i.test(url.pathname)){event.respondWith((async()=>{const cached=await caches.match(req);if(cached)return cached;const fresh=await fetch(req);if(fresh.ok){const cache=await caches.open(CACHE);cache.put(req,fresh.clone()).catch(()=>{});}return fresh;})());}});

function actionsFor(payload){
  if(payload.type==='fleet_trip_active')return [{action:'quick-stop',title:'Quick Stop'},{action:'open-fleet',title:'Deschide Fleet'}];
  if(payload.type==='crm_lead_new')return [{action:'open-crm',title:'Deschide CRM'}];
  if(payload.type==='workday_active')return [{action:'open-time',title:'Deschide pontaj'}];
  return [{action:'open-app',title:'Deschide'}];
}

self.addEventListener('push',event=>{event.waitUntil((async()=>{let payload={};try{payload=event.data?.json?.()||{};}catch{payload={body:event.data?.text?.()||''};}const tag=payload.tag||'bcb-manager';if(payload.type==='fleet_trip_stop'){const existing=await self.registration.getNotifications({tag});existing.forEach(notification=>notification.close());await self.registration.showNotification(payload.title||'BCB Fleet · Cursă încheiată',{body:payload.body||'Cursa a fost închisă corect.',icon:'/assets/images/logo.png',badge:'/assets/images/logo.png',tag:`${tag}-completed`,silent:true,data:{url:payload.url||'/admin/fleet.html',type:payload.type,tripId:payload.tripId||null}});return;}await self.registration.showNotification(payload.title||'BCB Business Manager',{body:payload.body||'Ai o actualizare nouă.',icon:'/assets/images/logo.png',badge:'/assets/images/logo.png',tag,renotify:false,silent:payload.silent===true,requireInteraction:payload.requireInteraction!==false,data:{url:payload.url||'/admin/dashboard.html',type:payload.type||'generic',tripId:payload.tripId||null,leadId:payload.leadId||null},actions:actionsFor(payload)});})());});

self.addEventListener('notificationclick',event=>{event.notification.close();const data=event.notification.data||{};let target=data.url||'/admin/dashboard.html';if(event.action==='quick-stop'&&data.tripId)target=`/admin/fleet.html?quickStop=${encodeURIComponent(data.tripId)}`;if(event.action==='open-time')target='/admin/time.html';event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const existing=windows.find(client=>new URL(client.url).origin===self.location.origin);if(existing){await existing.focus();if('navigate'in existing)await existing.navigate(target);return;}await self.clients.openWindow(target);})());});
