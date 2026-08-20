import { requireStaff, supabase, esc } from "./admin-common.js";

let ctx=null;
let busy=false;
const $=(s)=>document.querySelector(s);

function robotMarkup(){
  return `<span class="bcb-bot-stage" aria-hidden="true">
    <span class="bcb-bot-shadow"></span>
    <span class="bcb-bot-antenna"><i></i></span>
    <span class="bcb-bot-head">
      <span class="bcb-bot-face">
        <i class="bcb-bot-eye left"></i><i class="bcb-bot-eye right"></i>
        <i class="bcb-bot-mouth"></i>
      </span>
      <span class="bcb-bot-ear left"></span><span class="bcb-bot-ear right"></span>
    </span>
    <span class="bcb-bot-body"><i class="bcb-bot-core"></i></span>
    <span class="bcb-bot-arm left"></span><span class="bcb-bot-arm right"></span>
  </span>`;
}

function injectCopilot(){
  if($("#bcb-ai-copilot-widget"))return;
  const root=document.createElement("div");
  root.id="bcb-ai-copilot-widget";
  root.className="bcb-ai-widget";
  root.innerHTML=`
    <section id="bcb-ai-panel" class="bcb-ai-panel" aria-label="BCB AI Copilot" aria-hidden="true">
      <header class="bcb-ai-panel-head">
        <div class="bcb-ai-mini-bot">${robotMarkup()}</div>
        <div><span>BCB AI COPILOT</span><strong>Operational Intelligence</strong><small><i></i> Online · context securizat</small></div>
        <button id="bcb-ai-close" type="button" aria-label="Închide BCB AI"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <div id="bcb-copilot-messages" class="bcb-ai-messages">
        <article class="assistant"><div class="bcb-ai-avatar"><i class="fa-solid fa-sparkles"></i></div><div><strong>BCB Copilot</strong><p>Salut! Sunt aici să te ajut cu situația operațională din BCB Group: Fleet, proiecte, HR și priorități.</p></div></article>
      </div>
      <div class="bcb-ai-quick">
        <button type="button" data-copilot-prompt="Ce necesită atenție acum în BCB Group?">Priorități</button>
        <button type="button" data-copilot-prompt="Care este situația Fleet în acest moment?">Fleet</button>
        <button type="button" data-copilot-prompt="Ce scadențe HR avem în următoarele 30 de zile?">HR</button>
        <button type="button" data-copilot-prompt="Fă-mi un rezumat al proiectelor active.">Proiecte</button>
      </div>
      <form id="bcb-copilot-form" class="bcb-ai-form">
        <textarea id="bcb-copilot-question" rows="1" maxlength="1200" placeholder="Întreabă BCB Copilot..."></textarea>
        <button type="submit" aria-label="Trimite"><i class="fa-solid fa-arrow-up"></i></button>
      </form>
      <footer><i class="fa-solid fa-shield-halved"></i> Accesul și contextul sunt limitate automat după rol.</footer>
    </section>
    <button id="bcb-ai-toggle" class="bcb-ai-toggle" type="button" aria-label="Deschide BCB AI Copilot" aria-expanded="false">
      <span class="bcb-ai-orbit one"></span><span class="bcb-ai-orbit two"></span>
      ${robotMarkup()}
      <span class="bcb-ai-live-dot"></span>
      <span class="bcb-ai-hint">BCB AI</span>
    </button>`;
  document.body.appendChild(root);

  $("#bcb-ai-toggle")?.addEventListener("click",togglePanel);
  $("#bcb-ai-close")?.addEventListener("click",()=>setOpen(false));
  $("#bcb-copilot-form")?.addEventListener("submit",submitQuestion);
  document.querySelectorAll("[data-copilot-prompt]").forEach(btn=>btn.addEventListener("click",()=>ask(String(btn.dataset.copilotPrompt||""))));
  document.addEventListener("keydown",event=>{if(event.key==="Escape")setOpen(false)});
}

function setOpen(open){
  const panel=$("#bcb-ai-panel"),toggle=$("#bcb-ai-toggle");
  if(!panel||!toggle)return;
  panel.classList.toggle("is-open",open);
  panel.setAttribute("aria-hidden",String(!open));
  toggle.setAttribute("aria-expanded",String(open));
  if(open)setTimeout(()=>$("#bcb-copilot-question")?.focus(),180);
}

function togglePanel(){setOpen(!$("#bcb-ai-panel")?.classList.contains("is-open"));}

function addMessage(role,text,meta=""){
  const root=$("#bcb-copilot-messages");if(!root)return;
  const article=document.createElement("article");article.className=role;
  article.innerHTML=role==="user"
    ?`<div><strong>Tu</strong><p>${esc(text)}</p></div>`
    :`<div class="bcb-ai-avatar"><i class="fa-solid fa-sparkles"></i></div><div><strong>BCB Copilot</strong><p>${esc(text).replace(/\n/g,"<br>")}</p>${meta?`<small>${esc(meta)}</small>`:""}</div>`;
  root.appendChild(article);root.scrollTop=root.scrollHeight;
}

function setBusy(next){
  busy=next;
  const widget=$("#bcb-ai-copilot-widget"),button=$("#bcb-copilot-form button"),input=$("#bcb-copilot-question");
  widget?.classList.toggle("is-thinking",next);
  if(button){button.disabled=next;button.innerHTML=next?'<i class="fa-solid fa-circle-notch fa-spin"></i>':'<i class="fa-solid fa-arrow-up"></i>';}
  if(input)input.disabled=next;
}

async function submitQuestion(event){
  event.preventDefault();
  const input=$("#bcb-copilot-question");const q=String(input?.value||"").trim();if(!q||busy)return;
  input.value="";await ask(q);
}

async function ask(question){
  if(busy||!question)return;
  setOpen(true);addMessage("user",question);setBusy(true);
  try{
    const {data,error}=await supabase.functions.invoke("bcb-ai-copilot",{body:{question}});
    if(error)throw error;
    if(!data?.answer)throw new Error(data?.error||"Răspuns gol de la Copilot");
    addMessage("assistant",data.answer,data.mode==="ai"?"AI + context operațional BCB":"BCB Operational Intelligence");
  }catch(error){
    console.error("BCB Copilot:",error);
    addMessage("assistant","Nu am putut procesa întrebarea acum. Conexiunea cu serviciul AI a întâmpinat o eroare; restul Business Manager funcționează normal.","Diagnostic înregistrat");
  }finally{setBusy(false);}
}

(async()=>{ctx=await requireStaff();if(!ctx)return;injectCopilot();})();
