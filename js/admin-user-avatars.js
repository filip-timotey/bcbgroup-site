import { supabase } from './supabase-client.js';

let urls=new Map();

async function getProfiles(){
  const {data,error}=await supabase.from('profiles').select('id,avatar_path');
  if(error)return [];
  return data||[];
}
async function signed(path){
  if(!path)return null;if(urls.has(path))return urls.get(path);
  const {data}=await supabase.storage.from('profile-avatars').createSignedUrl(path,3600);
  const url=data?.signedUrl||null;urls.set(path,url);return url;
}
async function paint(){
  const profiles=await getProfiles();
  await Promise.all(profiles.map(async p=>{
    if(!p.avatar_path)return;
    const row=document.querySelector(`[data-user-id="${CSS.escape(p.id)}"]`);
    const avatar=row?.querySelector('.bcb-user-avatar');
    if(!avatar)return;
    const url=await signed(p.avatar_path);if(!url)return;
    avatar.innerHTML=`<img src="${url}" alt="Fotografie profil">`;
    avatar.classList.add('has-photo');
  }));
}
let timer=null;
const obs=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(paint,80);});
obs.observe(document.body,{childList:true,subtree:true});
paint();
