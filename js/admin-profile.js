import { supabase } from './supabase-client.js';
import { getStaffContext, invalidateStaffContext } from './admin-session.js';

let modal=null;

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
      root.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')openProfile();});
    }
  });
}

function ensureStyles(){
  if(document.querySelector('link[data-admin-profile-style]'))return;
  const link=document.createElement('link'); link.rel='stylesheet';link.href='../css/admin-profile.css';link.dataset.adminProfileStyle='true';document.head.appendChild(link);
}

async function openProfile(){
  const ctx=await getStaffContext(); if(!ctx)return;
  const profile=ctx.profile;
  const current=await signedAvatar(profile.avatar_path);
  if(!modal){modal=document.createElement('div');modal.className='bcb-profile-modal';document.body.appendChild(modal);}
  modal.innerHTML=`<div class="bcb-profile-modal__backdrop" data-close></div><section class="bcb-profile-modal__card"><button class="bcb-profile-modal__close" data-close>×</button><div class="bcb-profile-modal__head"><div class="bcb-profile-photo-preview">${current?`<img src="${current}" alt="Fotografie profil">`:`<span>${initials(profile.full_name||profile.email)}</span>`}</div><div><small>Profil Business Manager</small><h2>${profile.full_name||'Utilizator BCB'}</h2><p>${profile.email||''}</p></div></div><div class="bcb-profile-upload"><label for="bcb-profile-file"><i class="fa-solid fa-camera"></i><span>Schimbă fotografia</span><input id="bcb-profile-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><p>JPG, PNG sau WEBP · maximum 8 MB. Imaginea este privată și vizibilă doar utilizatorilor autorizați.</p><div id="bcb-profile-message"></div></div>${profile.avatar_path?'<button class="bcb-profile-remove" id="bcb-profile-remove"><i class="fa-solid fa-trash"></i> Elimină fotografia</button>':''}</section>`;
  modal.classList.add('is-open');
  modal.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',()=>modal.classList.remove('is-open')));
  modal.querySelector('#bcb-profile-file')?.addEventListener('change',uploadAvatar);
  modal.querySelector('#bcb-profile-remove')?.addEventListener('click',removeAvatar);
}

async function uploadAvatar(e){
  const file=e.target.files?.[0]; if(!file)return;
  const msg=modal.querySelector('#bcb-profile-message');
  if(file.size>8*1024*1024){msg.textContent='Fișierul depășește 8 MB.';msg.className='is-error';return;}
  const allowed=['image/jpeg','image/png','image/webp'];
  if(!allowed.includes(file.type)){msg.textContent='Format neacceptat.';msg.className='is-error';return;}
  const ctx=await getStaffContext();
  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
  const path=`${ctx.session.user.id}/avatar.${ext}`;
  msg.textContent='Se încarcă fotografia…';msg.className='is-loading';
  const {error:uploadError}=await supabase.storage.from('profile-avatars').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});
  if(uploadError){msg.textContent=uploadError.message;msg.className='is-error';return;}
  const {error:rpcError}=await supabase.rpc('set_own_avatar',{p_avatar_path:path});
  if(rpcError){msg.textContent=rpcError.message;msg.className='is-error';return;}
  invalidateStaffContext();
  msg.textContent='Fotografia a fost actualizată.';msg.className='is-success';
  setTimeout(()=>window.location.reload(),500);
}

async function removeAvatar(){
  const ctx=await getStaffContext(); if(!ctx?.profile?.avatar_path)return;
  const msg=modal.querySelector('#bcb-profile-message');msg.textContent='Se elimină…';msg.className='is-loading';
  await supabase.storage.from('profile-avatars').remove([ctx.profile.avatar_path]);
  const {error}=await supabase.rpc('set_own_avatar',{p_avatar_path:null});
  if(error){msg.textContent=error.message;msg.className='is-error';return;}
  invalidateStaffContext(); window.location.reload();
}

export async function initAdminProfile(){
  ensureStyles();
  const ctx=await getStaffContext(); if(!ctx)return;
  await paintAvatars(ctx.profile);
}
