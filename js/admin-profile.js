import { supabase } from './supabase-client.js';
import { getStaffContext, invalidateStaffContext } from './admin-session.js';

let modal=null;
let cropState=null;

async function signedAvatar(path){
  if(!path) return null;
  const {data,error}=await supabase.storage.from('profile-avatars').createSignedUrl(path,3600);
  if(error) return null;
  return data?.signedUrl||null;
}

function initials(name='BCB'){
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'BCB';
}

async function paintAvatars(profile){
  const url=await signedAvatar(profile.avatar_path);
  document.querySelectorAll('.bcb-admin-avatar').forEach(root=>{
    root.classList.add('bcb-profile-avatar');
    root.setAttribute('role','button');
    root.setAttribute('tabindex','0');
    root.setAttribute('title','Profilul meu');
    root.innerHTML=url?`<img src="${url}" alt="Fotografie profil">`:`<span>${initials(profile.full_name||profile.email)}</span>`;
    if(!root.dataset.profileBound){
      root.dataset.profileBound='true';
      root.addEventListener('click',openProfile);
      root.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openProfile();}});
    }
  });
}

function ensureStyles(){
  if(document.querySelector('link[data-admin-profile-style]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='../css/admin-profile.css';
  link.dataset.adminProfileStyle='true';
  document.head.appendChild(link);
}

function resetCropState(){
  if(cropState?.objectUrl) URL.revokeObjectURL(cropState.objectUrl);
  cropState=null;
}

function renderCrop(){
  if(!cropState||!modal)return;
  const image=modal.querySelector('#bcb-crop-image');
  const zoom=modal.querySelector('#bcb-crop-zoom');
  if(!image)return;
  image.style.transform=`translate(calc(-50% + ${cropState.x}px), calc(-50% + ${cropState.y}px)) scale(${cropState.scale})`;
  if(zoom) zoom.value=String(cropState.scale);
}

function bindCropEditor(){
  const stage=modal.querySelector('#bcb-crop-stage');
  const image=modal.querySelector('#bcb-crop-image');
  const zoom=modal.querySelector('#bcb-crop-zoom');
  if(!stage||!image||!zoom||!cropState)return;

  let dragging=false,startX=0,startY=0,baseX=0,baseY=0;
  const start=e=>{
    dragging=true;
    const p=e.touches?.[0]||e;
    startX=p.clientX;startY=p.clientY;baseX=cropState.x;baseY=cropState.y;
    stage.classList.add('is-dragging');
    if(e.pointerId!=null) stage.setPointerCapture?.(e.pointerId);
  };
  const move=e=>{
    if(!dragging)return;
    const p=e.touches?.[0]||e;
    cropState.x=baseX+(p.clientX-startX);
    cropState.y=baseY+(p.clientY-startY);
    renderCrop();
    if(e.cancelable)e.preventDefault();
  };
  const end=()=>{dragging=false;stage.classList.remove('is-dragging');};
  stage.addEventListener('pointerdown',start);
  stage.addEventListener('pointermove',move);
  stage.addEventListener('pointerup',end);
  stage.addEventListener('pointercancel',end);
  zoom.addEventListener('input',()=>{cropState.scale=Number(zoom.value);renderCrop();});
  modal.querySelector('#bcb-crop-reset')?.addEventListener('click',()=>{cropState.x=0;cropState.y=0;cropState.scale=1;renderCrop();});
  modal.querySelector('#bcb-crop-save')?.addEventListener('click',saveCroppedAvatar);
}

async function openProfile(){
  const ctx=await getStaffContext(); if(!ctx)return;
  const profile=ctx.profile;
  const current=await signedAvatar(profile.avatar_path);
  resetCropState();
  if(!modal){modal=document.createElement('div');modal.className='bcb-profile-modal';document.body.appendChild(modal);}
  modal.innerHTML=`<div class="bcb-profile-modal__backdrop" data-close></div>
    <section class="bcb-profile-modal__card">
      <button class="bcb-profile-modal__close" data-close>×</button>
      <div class="bcb-profile-modal__head">
        <div class="bcb-profile-photo-preview">${current?`<img src="${current}" alt="Fotografie profil">`:`<span>${initials(profile.full_name||profile.email)}</span>`}</div>
        <div><small>Profil Business Manager</small><h2>${profile.full_name||'Utilizator BCB'}</h2><p>${profile.email||''}</p></div>
      </div>
      <div class="bcb-profile-upload">
        <label for="bcb-profile-file"><i class="fa-solid fa-camera"></i><span>Alege o fotografie</span><input id="bcb-profile-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
        <p>JPG, PNG sau WEBP · maximum 8 MB. După selectare poți ajusta poziția și zoom-ul înainte de salvare.</p>
        <div id="bcb-profile-message"></div>
      </div>
      <div id="bcb-crop-editor" class="bcb-crop-editor" hidden>
        <div class="bcb-crop-stage" id="bcb-crop-stage"><img id="bcb-crop-image" alt="Previzualizare crop"><div class="bcb-crop-mask"></div></div>
        <div class="bcb-crop-controls">
          <label><span><i class="fa-solid fa-magnifying-glass"></i> Zoom</span><input id="bcb-crop-zoom" type="range" min="1" max="3" step="0.01" value="1"></label>
          <button type="button" id="bcb-crop-reset"><i class="fa-solid fa-rotate-left"></i> Resetează</button>
          <button type="button" id="bcb-crop-save" class="is-primary"><i class="fa-solid fa-check"></i> Salvează fotografia</button>
        </div>
        <p class="bcb-crop-hint"><i class="fa-solid fa-up-down-left-right"></i> Trage fotografia cu mouse-ul sau degetul până când încadrarea este exact cum dorești.</p>
      </div>
      ${profile.avatar_path?'<button class="bcb-profile-remove" id="bcb-profile-remove"><i class="fa-solid fa-trash"></i> Elimină fotografia</button>':''}
    </section>`;
  modal.classList.add('is-open');
  modal.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',()=>{resetCropState();modal.classList.remove('is-open');}));
  modal.querySelector('#bcb-profile-file')?.addEventListener('change',prepareAvatarCrop);
  modal.querySelector('#bcb-profile-remove')?.addEventListener('click',removeAvatar);
}

async function prepareAvatarCrop(e){
  const file=e.target.files?.[0]; if(!file)return;
  const msg=modal.querySelector('#bcb-profile-message');
  if(file.size>8*1024*1024){msg.textContent='Fișierul depășește 8 MB.';msg.className='is-error';return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){msg.textContent='Format neacceptat.';msg.className='is-error';return;}

  resetCropState();
  const objectUrl=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    cropState={file,objectUrl,image:img,x:0,y:0,scale:1};
    const editor=modal.querySelector('#bcb-crop-editor');
    const cropImage=modal.querySelector('#bcb-crop-image');
    cropImage.src=objectUrl;
    editor.hidden=false;
    msg.textContent='Ajustează fotografia și apasă „Salvează fotografia”.';
    msg.className='is-success';
    requestAnimationFrame(()=>{renderCrop();bindCropEditor();});
  };
  img.onerror=()=>{URL.revokeObjectURL(objectUrl);msg.textContent='Imaginea nu a putut fi citită.';msg.className='is-error';};
  img.src=objectUrl;
}

function croppedBlob(){
  return new Promise((resolve,reject)=>{
    if(!cropState)return reject(new Error('Nu există o fotografie selectată.'));
    const stage=modal.querySelector('#bcb-crop-stage');
    if(!stage)return reject(new Error('Editorul foto nu este disponibil.'));
    const size=512;
    const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
    const c=canvas.getContext('2d');
    const img=cropState.image;
    const stageSize=stage.clientWidth||300;
    const base=Math.max(stageSize/img.naturalWidth,stageSize/img.naturalHeight);
    const renderedW=img.naturalWidth*base*cropState.scale;
    const renderedH=img.naturalHeight*base*cropState.scale;
    const pxToOutput=size/stageSize;
    const drawW=renderedW*pxToOutput,drawH=renderedH*pxToOutput;
    const dx=(size-drawW)/2+cropState.x*pxToOutput;
    const dy=(size-drawH)/2+cropState.y*pxToOutput;
    c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    c.drawImage(img,dx,dy,drawW,drawH);
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Imaginea nu a putut fi procesată.')),'image/webp',0.88);
  });
}

async function saveCroppedAvatar(){
  const msg=modal.querySelector('#bcb-profile-message');
  const save=modal.querySelector('#bcb-crop-save');
  try{
    save.disabled=true;save.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Se salvează…';
    msg.textContent='Optimizăm și încărcăm fotografia…';msg.className='is-loading';
    const blob=await croppedBlob();
    const ctx=await getStaffContext();
    const path=`${ctx.session.user.id}/avatar.webp`;
    const {error:uploadError}=await supabase.storage.from('profile-avatars').upload(path,blob,{upsert:true,contentType:'image/webp',cacheControl:'3600'});
    if(uploadError)throw uploadError;
    const {error:rpcError}=await supabase.rpc('set_own_avatar',{p_avatar_path:path});
    if(rpcError)throw rpcError;
    invalidateStaffContext();
    msg.textContent='Fotografia a fost ajustată și salvată.';msg.className='is-success';
    resetCropState();
    setTimeout(()=>window.location.reload(),500);
  }catch(error){msg.textContent=error?.message||'Fotografia nu a putut fi salvată.';msg.className='is-error';save.disabled=false;save.innerHTML='<i class="fa-solid fa-check"></i> Salvează fotografia';}
}

async function removeAvatar(){
  const ctx=await getStaffContext(); if(!ctx?.profile?.avatar_path)return;
  const msg=modal.querySelector('#bcb-profile-message');msg.textContent='Se elimină…';msg.className='is-loading';
  await supabase.storage.from('profile-avatars').remove([ctx.profile.avatar_path]);
  const {error}=await supabase.rpc('set_own_avatar',{p_avatar_path:null});
  if(error){msg.textContent=error.message;msg.className='is-error';return;}
  invalidateStaffContext();window.location.reload();
}

export async function initAdminProfile(){
  ensureStyles();
  const ctx=await getStaffContext(); if(!ctx)return;
  await paintAvatars(ctx.profile);
}
