const CACHE='bcb-manager-shell-v1';
const SHELL=[
  '/admin/index.html',
  '/admin/dashboard.html',
  '/admin/fleet.html',
  '/admin/employees.html',
  '/css/style.css',
  '/css/admin-2026.css',
  '/css/admin-nav.css',
  '/assets/images/logo.png',
  '/manifest.webmanifest'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('bcb-manager-shell-')).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return;

  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req);
        const cache=await caches.open(CACHE);
        cache.put(req,fresh.clone()).catch(()=>{});
        return fresh;
      }catch{
        return (await caches.match(req)) || (await caches.match('/admin/index.html'));
      }
    })());
    return;
  }

  if(/\.(?:css|js|png|jpg|jpeg|webp|svg|woff2?)$/i.test(url.pathname)){
    event.respondWith((async()=>{
      const cached=await caches.match(req);
      const network=fetch(req).then(async res=>{
        if(res.ok){const cache=await caches.open(CACHE);cache.put(req,res.clone()).catch(()=>{});}
        return res;
      }).catch(()=>cached);
      return cached || network;
    })());
  }
});
