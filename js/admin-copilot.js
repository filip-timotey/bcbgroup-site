import { requireStaff, supabase, esc } from "./admin-common.js";

let ctx=null,busy=false;
const $=(s)=>document.querySelector(s);
const HISTORY_KEY="bcb-ai-history-v4";
let conversation=loadHistory();

function loadHistory(){try{const raw=JSON.parse(sessionStorage.getItem(HISTORY_KEY)||"[]");return Array.isArray(raw)?raw.slice(-10).filter(x=>x&&["user","assistant"].includes(x.role)&&typeof x.content==="string"):[];}catch{return [];}}
function saveHistory(){try{sessionStorage.setItem(HISTORY_KEY,JSON.stringify(conversation.slice(-10)));}catch{}}
function clearHistory(){conversation=[];saveHistory();const root=$("#bcb-copilot-messages");if(root)root.innerHTML=welcomeMarkup();}
function currentPage(){return `${location.pathname.split('/').pop()||'dashboard.html'}${location.hash||''}`;}

function robotMarkup(){return `<span class="bcb-bot-stage" aria-hidden="true"><span class="bcb-bot-shadow"></span><span class="bcb-bot-antenna"><i></i></span><span class="bcb-bot-head"><span class="bcb-bot-face"><i class="bcb-bot-eye left"></i><i class="bcb-bot-eye right"></i><i class="bcb-bot-mouth"></i></span><span class="bcb-bot-ear left"></span><span class="bcb-bot-ear right"></span></span><span class="bcb-bot-body"><i class="bcb-bot-core"></i></span><span class="bcb-bot-arm left"></span><span class="bcb-bot-arm right"></span></span>`;}
function welcomeMarkup(){return `<article class="assistant"><div class="bcb-ai-avatar"><i class="fa-solid fa-sparkles"></i></div><div><strong>BCB Copilot</strong><p>Salut! Mă poți întreba atât despre BCB Group și platformă, cât și despre lucruri generale. Pentru informații actuale pot folosi și web-ul.</p><small>AI general · Context BCB · Web când este necesar</small></div></article>`;}

function injectCopilot(){
  if($("#bcb-ai-copilot-widget"))return;
  const root=document.createElement("div");root.id="bcb-ai-copilot-widget";root.className="bcb-ai-widget";
  root.innerHTML=`<section id="bcb-ai-panel" class="bcb-ai-panel" aria-label="BCB AI Copilot" aria-hidden="true"><header class="bcb-ai-panel-head"><div class="bcb-ai-mini-bot">${robotMarkup()}</div><div><span>BCB AI COPILOT</span><strong>Hybrid Intelligence</strong><small><i></i> General AI · BCB Context · Web</small></div><button id="bcb-ai-new-chat" type="button" aria-label="Conversație nouă" title="Conversație nouă"><i class="fa-solid fa-rotate"></i></button><button id="bcb-ai-close" type="button" aria-label="Închide BCB AI"><i class="fa-solid fa-xmark"></i></button></header><div class="bcb-ai-capabilities"><span><i class="fa-solid fa-brain"></i> AI general</span><span><i class="fa-solid fa-building-shield"></i> BCB context</span><span><i class="fa-solid fa-globe"></i> Web automat</span></div><div id="bcb-copilot-messages" class="bcb-ai-messages">${welcomeMarkup()}</div><div class="bcb-ai-quick"><button type="button" data-copilot-prompt="Ce necesită atenție acum în BCB Group?">Priorități BCB</button><button type="button" data-copilot-prompt="Care este situația Fleet în acest moment?">Fleet</button><button type="button" data-copilot-prompt="Explică-mi pe scurt ce poți face pentru mine, inclusiv în afara platformei.">Ce poți face?</button><button type="button" data-copilot-prompt="Care sunt cele mai importante noutăți economice din România astăzi?">Web actual</button></div><form id="bcb-copilot-form" class="bcb-ai-form"><textarea id="bcb-copilot-question" rows="1" maxlength="1800" placeholder="Întreabă orice..."></textarea><button type="submit" aria-label="Trimite"><i class="fa-solid fa-arrow-up"></i></button></form><footer><i class="fa-solid fa-shield-halved"></i> Contextul intern este filtrat automat după rol. Web-ul este folosit doar când ajută.</footer></section><button id="bcb-ai-toggle" class="bcb-ai-toggle" type="button" aria-label="Deschide BCB AI Copilot" aria-expanded="false"><span class="bcb-ai-orbit one"></span><span class="bcb-ai-orbit two"></span>${robotMarkup()}<span class="bcb-ai-live-dot"></span><span class="bcb-ai-hint">BCB AI</span></button>`;
  document.body.appendChild(root);
  $("#bcb-ai-toggle")?.addEventListener("click",togglePanel);$("#bcb-ai-close")?.addEventListener("click",()=>setOpen(false));$("#bcb-ai-new-chat")?.addEventListener("click",()=>{if(confirm("Începem o conversație nouă?"))clearHistory();});$("#bcb-copilot-form")?.addEventListener("submit",submitQuestion);document.querySelectorAll("[data-copilot-prompt]").forEach(btn=>btn.addEventListener("click",()=>ask(String(btn.dataset.copilotPrompt||""))));document.addEventListener("keydown",event=>{if(event.key==="Escape")setOpen(false)});
  conversation.slice(-6).forEach(item=>addMessage(item.role,item.content,"",[],false));
}
function setOpen(open){const panel=$("#bcb-ai-panel"),toggle=$("#bcb-ai-toggle");if(!panel||!toggle)return;panel.classList.toggle("is-open",open);panel.setAttribute("aria-hidden",String(!open));toggle.setAttribute("aria-expanded",String(open));if(open)setTimeout(()=>$("#bcb-copilot-question")?.focus(),180);}
function togglePanel(){setOpen(!$("#bcb-ai-panel")?.classList.contains("is-open"));}

function safeUrl(value){try{const url=new URL(value);return /^https?:$/.test(url.protocol)?url.href:"";}catch{return "";}}
function addMessage(role,text,meta="",sources=[],persist=true){
  const root=$("#bcb-copilot-messages");if(!root)return;
  const article=document.createElement("article");article.className=role;
  article.innerHTML=role==="user"?`<div><strong>Tu</strong><p>${esc(text)}</p></div>`:`<div class="bcb-ai-avatar"><i class="fa-solid fa-sparkles"></i></div><div class="bcb-ai-answer"><strong>BCB Copilot</strong><p>${esc(text).replace(/\n/g,"<br>")}</p>${meta?`<small>${esc(meta)}</small>`:""}</div>`;
  if(role==="assistant"&&Array.isArray(sources)&&sources.length){const box=document.createElement("div");box.className="bcb-ai-sources";box.innerHTML='<span>Surse web</span>';sources.slice(0,4).forEach((source,index)=>{const href=safeUrl(source?.url);if(!href)return;const a=document.createElement("a");a.href=href;a.target="_blank";a.rel="noopener noreferrer";a.textContent=String(source?.title||`Sursa ${index+1}`).slice(0,70);box.appendChild(a);});article.querySelector(".bcb-ai-answer")?.appendChild(box);}
  root.appendChild(article);root.scrollTop=root.scrollHeight;
  if(persist&&["user","assistant"].includes(role)){conversation.push({role,content:String(text).slice(0,1800)});conversation=conversation.slice(-10);saveHistory();}
}
function setBusy(next){busy=next;const widget=$("#bcb-ai-copilot-widget"),button=$("#bcb-copilot-form button"),input=$("#bcb-copilot-question");widget?.classList.toggle("is-thinking",next);if(button){button.disabled=next;button.innerHTML=next?'<i class="fa-solid fa-circle-notch fa-spin"></i>':'<i class="fa-solid fa-arrow-up"></i>';}if(input)input.disabled=next;}
async function submitQuestion(event){event.preventDefault();const input=$("#bcb-copilot-question"),q=String(input?.value||"").trim();if(!q||busy)return;input.value="";await ask(q);}
async function ask(question){
  if(busy||!question)return;setOpen(true);const prior=conversation.slice(-8);addMessage("user",question);setBusy(true);
  try{
    const {data,error}=await supabase.functions.invoke("bcb-ai-copilot",{body:{question,history:prior,page:currentPage()}});if(error)throw error;if(!data?.answer)throw new Error(data?.error||"Răspuns gol de la Copilot");
    const meta=data.usedWeb?"AI + web actual + context permis":data.mode?.startsWith("hybrid")?"AI general + context permis":"BCB Operational Intelligence";
    addMessage("assistant",data.answer,meta,data.sources||[]);
  }catch(error){console.error("BCB Copilot:",error);addMessage("assistant","Nu am putut procesa întrebarea acum. Restul Business Manager funcționează normal; poți încerca din nou.","Eroare de conexiune");}finally{setBusy(false);}
}

(async()=>{ctx=await requireStaff();if(!ctx)return;injectCopilot();})();