(()=>{
  if(window.__bcbPwaInit)return;window.__bcbPwaInit=true;
  const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  let deferredPrompt=null;

  function ensureHead(){
    if(!document.querySelector('link[rel="manifest"]')){const l=document.createElement('link');l.rel='manifest';l.href='../manifest.webmanifest';document.head.appendChild(l);}
    if(!document.querySelector('meta[name="theme-color"]')){const m=document.createElement('meta');m.name='theme-color';m.content='#20252a';document.head.appendChild(m);}
    if(!document.querySelector('meta[name="apple-mobile-web-app-capable"]')){const m=document.createElement('meta');m.name='apple-mobile-web-app-capable';m.content='yes';document.head.appendChild(m);}
    if(!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')){const m=document.createElement('meta');m.name='apple-mobile-web-app-status-bar-style';m.content='black-translucent';document.head.appendChild(m);}
    if(!document.querySelector('meta[name="apple-mobile-web-app-title"]')){const m=document.createElement('meta');m.name='apple-mobile-web-app-title';m.content='BCB Manager';document.head.appendChild(m);}
    if(!document.querySelector('link[rel="apple-touch-icon"]')){const l=document.createElement('link');l.rel='apple-touch-icon';l.href='../assets/images/logo.png';document.head.appendChild(l);}
  }

  function ensureStyle(){
    if(document.querySelector('style[data-bcb-pwa]'))return;
    const s=document.createElement('style');s.dataset.bcbPwa='true';s.textContent=`
      .bcb-pwa-install{position:fixed;right:18px;bottom:18px;z-index:11000;display:flex;align-items:center;gap:10px;padding:12px 15px;border:1px solid rgba(211,160,47,.35);border-radius:16px;background:rgba(31,37,42,.96);color:#fff;box-shadow:0 16px 42px rgba(0,0,0,.24);font:800 12px/1.2 Arial,sans-serif;cursor:pointer;backdrop-filter:blur(12px)}.bcb-pwa-install i{color:#e0ac3c}.bcb-pwa-install[hidden]{display:none!important}.bcb-pwa-toast{position:fixed;left:50%;bottom:20px;z-index:11001;transform:translateX(-50%);max-width:min(92vw,480px);padding:13px 16px;border-radius:14px;background:#20252a;color:#fff;box-shadow:0 16px 40px rgba(0,0,0,.25);font:700 12px/1.45 Arial,sans-serif;text-align:center}.bcb-pwa-ios{margin-top:6px;color:#e3b64d;font-size:11px}@media(max-width:620px){.bcb-pwa-install{right:12px;bottom:12px;padding:11px 13px;border-radius:14px}.bcb-pwa-toast{bottom:12px}}
    `;document.head.appendChild(s);
  }

  function toast(text,ios=false){const old=document.querySelector('.bcb-pwa-toast');old?.remove();const el=document.createElement('div');el.className='bcb-pwa-toast';el.innerHTML=`${text}${ios?'<div class="bcb-pwa-ios">Safari → Partajează → Adaugă la ecranul principal</div>':''}`;document.body.appendChild(el);setTimeout(()=>el.remove(),7000);}

  function installButton(){
    if(isStandalone()||document.querySelector('.bcb-pwa-install'))return;
    const b=document.createElement('button');b.type='button';b.className='bcb-pwa-install';b.hidden=true;b.innerHTML='<i class="fa-solid fa-mobile-screen-button"></i><span>Instalează BCB Manager</span>';document.body.appendChild(b);
    b.addEventListener('click',async()=>{
      if(deferredPrompt){deferredPrompt.prompt();const choice=await deferredPrompt.userChoice.catch(()=>null);deferredPrompt=null;b.hidden=true;if(choice?.outcome==='accepted')toast('BCB Business Manager a fost adăugat pe dispozitiv.');return;}
      const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
      toast(ios?'Pentru instalare pe iPhone folosește opțiunea de mai jos.':'Deschide meniul browserului și alege „Instalează aplicația” / „Adaugă pe ecranul principal”.',ios);
    });
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;b.hidden=false;});
    if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!isStandalone())b.hidden=false;
  }

  async function register(){
    if(!('serviceWorker'in navigator))return;
    try{await navigator.serviceWorker.register('../service-worker.js',{scope:'/'});}catch(e){console.error('BCB service worker:',e);}
  }

  function init(){ensureHead();ensureStyle();installButton();register();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
