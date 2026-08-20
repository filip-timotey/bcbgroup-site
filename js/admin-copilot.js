import { requireStaff, supabase, esc } from "./admin-common.js";

let ctx=null;
const $=(s)=>document.querySelector(s);

function injectCopilot(){
  if($("#bcb-copilot"))return;
  const main=$(".bcb-admin-main");
  const projects=$("#projects");
  if(!main)return;
  const section=document.createElement("section");
  section.id="bcb-copilot";
  section.className="bcb-copilot";
  section.innerHTML=`
    <div class="bcb-copilot-head">
      <div class="bcb-copilot-mark"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
      <div><span class="bcb-admin-section-kicker">Operational Intelligence</span><h2>BCB AI Copilot</h2><p>Întreabă despre proiecte, Fleet, HR și prioritățile operaționale. Copilot folosește doar indicatori agregați și respectă nivelul tău de acces.</p></div>
      <span class="bcb-copilot-status"><i class="fa-solid fa-shield-halved"></i> Secure context</span>
    </div>
    <div class="bcb-copilot-grid">
      <div class="bcb-copilot-chat">
        <div id="bcb-copilot-messages" class="bcb-copilot-messages"><article class="assistant"><div class="icon"><i class="fa-solid fa-sparkles"></i></div><div><strong>BCB Copilot</strong><p>Pot sintetiza situația operațională curentă și evidenția ce necesită atenție.</p></div></article></div>
        <form id="bcb-copilot-form" class="bcb-copilot-form"><textarea id="bcb-copilot-question" rows="2" maxlength="1200" placeholder="Ex: Ce necesită atenție azi în BCB Group?"></textarea><button type="submit"><i class="fa-solid fa-arrow-up"></i></button></form>
      </div>
      <aside class="bcb-copilot-prompts"><span>Întrebări rapide</span>
        <button type="button" data-copilot-prompt="Ce necesită atenție acum în BCB Group?"><i class="fa-solid fa-triangle-exclamation"></i> Priorități acum</button>
        <button type="button" data-copilot-prompt="Care este situația Fleet în acest moment?"><i class="fa-solid fa-car-side"></i> Situație Fleet</button>
        <button type="button" data-copilot-prompt="Ce scadențe HR avem în următoarele 30 de zile?"><i class="fa-solid fa-users"></i> Scadențe HR</button>
        <button type="button" data-copilot-prompt="Fă-mi un rezumat al proiectelor active."><i class="fa-solid fa-building"></i> Proiecte active</button>
      </aside>
    </div>`;
  main.insertBefore(section,projects||null);
  $("#bcb-copilot-form")?.addEventListener("submit",submitQuestion);
  document.querySelectorAll("[data-copilot-prompt]").forEach(btn=>btn.addEventListener("click",()=>ask(String(btn.dataset.copilotPrompt||""))));
}

function addMessage(role,text,meta=""){
  const root=$("#bcb-copilot-messages");if(!root)return;
  const article=document.createElement("article");article.className=role;
  article.innerHTML=role==="user"?`<div><strong>Tu</strong><p>${esc(text)}</p></div>`:`<div class="icon"><i class="fa-solid fa-sparkles"></i></div><div><strong>BCB Copilot</strong><p>${esc(text).replace(/\n/g,"<br>")}</p>${meta?`<small>${esc(meta)}</small>`:""}</div>`;
  root.appendChild(article);root.scrollTop=root.scrollHeight;
}

async function submitQuestion(event){event.preventDefault();const input=$("#bcb-copilot-question");const q=String(input?.value||"").trim();if(!q)return;input.value="";await ask(q);}

async function ask(question){
  addMessage("user",question);
  const form=$("#bcb-copilot-form"),button=form?.querySelector("button");if(button){button.disabled=true;button.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i>';}
  try{
    const {data,error}=await supabase.functions.invoke("bcb-ai-copilot",{body:{question}});
    if(error)throw error;
    addMessage("assistant",data?.answer||"Nu am putut genera un răspuns.",data?.mode==="ai"?"AI + context operațional BCB":"Operational intelligence · fallback securizat");
  }catch(error){console.error(error);addMessage("assistant","Copilot nu este disponibil momentan. Restul Business Manager continuă să funcționeze normal.");}
  finally{if(button){button.disabled=false;button.innerHTML='<i class="fa-solid fa-arrow-up"></i>';}}
}

(async()=>{ctx=await requireStaff();if(!ctx)return;injectCopilot();})();
