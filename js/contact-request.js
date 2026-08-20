import { supabase } from "./supabase-client.js";

const form=document.getElementById("oferta");

function createRequestId(){
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  const bytes=new Uint8Array(16);
  if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(bytes);
  else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
  bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
  const hex=[...bytes].map(value=>value.toString(16).padStart(2,"0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function buildPayload(fd,requestId){
  return {
    external_request_id:requestId,
    full_name:String(fd.get("Nume client")||"").trim(),
    phone:String(fd.get("Telefon")||"").trim(),
    email:String(fd.get("email")||"").trim()||null,
    location:String(fd.get("Zona")||"").trim()||null,
    project_type:String(fd.get("Tip proiect")||"").trim()||null,
    estimated_budget:String(fd.get("Buget estimativ")||"").trim()||null,
    desired_start:String(fd.get("Perioada dorită")||"").trim()||null,
    project_stage:String(fd.get("Etapa proiectului")||"").trim()||null,
    message:String(fd.get("Mesaj")||"").trim(),
    website:String(fd.get("website")||"").trim()
  };
}

async function saveToManager(payload){
  try{
    const {data,error}=await supabase.functions.invoke("submit-quote-request",{body:payload});
    if(!error&&data?.success)return {ok:true,data};
    if(error)console.warn("BCB CRM intake function:",error);
  }catch(error){console.warn("BCB CRM intake unavailable:",error);}

  try{
    const {error}=await supabase.from("quote_requests").insert({
      external_request_id:payload.external_request_id,
      full_name:payload.full_name,phone:payload.phone,email:payload.email,location:payload.location,
      project_type:payload.project_type,estimated_budget:payload.estimated_budget,desired_start:payload.desired_start,
      project_stage:payload.project_stage,message:payload.message,status:"new",source:"website"
    });
    if(!error||error?.code==="23505")return {ok:true,fallback:true};
    console.warn("BCB CRM direct fallback:",error.message);
  }catch(error){console.warn("BCB CRM direct fallback error:",error);}
  return {ok:false};
}

async function sendFormspree(fd){
  try{
    const response=await fetch("https://formspree.io/f/xkolagbg",{method:"POST",body:fd,headers:{Accept:"application/json"}});
    return response.ok;
  }catch{return false;}
}

if(form){
  if(!form.querySelector('[name="website"]')){
    const honeypot=document.createElement("input");honeypot.type="text";honeypot.name="website";honeypot.tabIndex=-1;honeypot.autocomplete="off";honeypot.setAttribute("aria-hidden","true");honeypot.style.cssText="position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important";form.appendChild(honeypot);
  }

  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(form.dataset.submitting==="true")return;
    form.dataset.submitting="true";
    const submitButton=form.querySelector("button[type='submit']"),originalButton=submitButton?.innerHTML;
    if(submitButton){submitButton.disabled=true;submitButton.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Se înregistrează...';}

    const fd=new FormData(form);
    const requestId=form.dataset.requestId||createRequestId();
    form.dataset.requestId=requestId;
    const payload=buildPayload(fd,requestId);

    try{
      const [manager,formspree]=await Promise.all([saveToManager(payload),sendFormspree(fd)]);
      if(!manager.ok&&!formspree)throw new Error("All quote delivery channels failed");
      sessionStorage.setItem("bcb-last-quote-request",JSON.stringify({id:manager.data?.id||null,at:Date.now()}));
      window.location.href="multumim.html";
    }catch(error){
      console.error("BCB contact form error:",error);
      alert("A apărut o problemă la trimitere. Datele nu s-au pierdut din formular; încearcă din nou sau contactează-ne telefonic.");
      form.dataset.submitting="false";
      if(submitButton){submitButton.disabled=false;submitButton.innerHTML=originalButton;}
    }
  });
}
