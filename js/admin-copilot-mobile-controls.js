const POSITION_KEY_BASE="bcb-ai-position-v2";
const MOBILE_QUERY="(max-width: 620px)";

function clamp(value,min,max){return Math.max(min,Math.min(value,max));}
function isMobile(){return window.matchMedia(MOBILE_QUERY).matches;}
function positionKey(){return `${POSITION_KEY_BASE}:${isMobile()?"mobile":"desktop"}`;}
function getWidget(){return document.querySelector("#bcb-ai-copilot-widget");}
function getToggle(){return document.querySelector("#bcb-ai-toggle");}
function getPanel(){return document.querySelector("#bcb-ai-panel");}

function syncEngagedState(){
  const widget=getWidget(),toggle=getToggle();
  if(!widget||!toggle)return;
  widget.classList.toggle("is-engaged",toggle.getAttribute("aria-expanded")==="true");
}

function clampWidgetPosition(widget,left,top){
  const pad=8;
  const rect=widget.getBoundingClientRect();
  const width=rect.width||88,height=rect.height||88;
  return {
    left:clamp(left,pad,Math.max(pad,window.innerWidth-width-pad)),
    top:clamp(top,pad,Math.max(pad,window.innerHeight-height-pad))
  };
}

function applyPosition(widget,left,top){
  const pos=clampWidgetPosition(widget,left,top);
  widget.style.left=`${Math.round(pos.left)}px`;
  widget.style.top=`${Math.round(pos.top)}px`;
  widget.style.right="auto";
  widget.style.bottom="auto";
  widget.classList.add("has-custom-position");
  return pos;
}

function restorePosition(widget){
  try{
    const saved=JSON.parse(localStorage.getItem(positionKey())||"null");
    if(!saved||!Number.isFinite(saved.left)||!Number.isFinite(saved.top))return;
    applyPosition(widget,saved.left,saved.top);
  }catch{}
}

function savePosition(widget){
  const rect=widget.getBoundingClientRect();
  try{localStorage.setItem(positionKey(),JSON.stringify({left:Math.round(rect.left),top:Math.round(rect.top)}));}catch{}
}

function setupDrag(widget,toggle){
  let active=false,moved=false,pointerId=null,startX=0,startY=0,startLeft=0,startTop=0;

  toggle.addEventListener("pointerdown",event=>{
    if(getPanel()?.classList.contains("is-open"))return;
    if(event.button!==undefined&&event.button!==0)return;
    const rect=widget.getBoundingClientRect();
    active=true;moved=false;pointerId=event.pointerId;
    startX=event.clientX;startY=event.clientY;startLeft=rect.left;startTop=rect.top;
    toggle.setPointerCapture?.(pointerId);
    widget.classList.add("is-dragging");
  });

  toggle.addEventListener("pointermove",event=>{
    if(!active||event.pointerId!==pointerId)return;
    const dx=event.clientX-startX,dy=event.clientY-startY;
    if(!moved&&Math.hypot(dx,dy)<7)return;
    moved=true;
    event.preventDefault();
    applyPosition(widget,startLeft+dx,startTop+dy);
  },{passive:false});

  const finish=event=>{
    if(!active||event.pointerId!==pointerId)return;
    active=false;
    widget.classList.remove("is-dragging");
    toggle.releasePointerCapture?.(pointerId);
    if(moved){savePosition(widget);toggle.dataset.dragSuppressClick="1";setTimeout(()=>delete toggle.dataset.dragSuppressClick,0);}
  };
  toggle.addEventListener("pointerup",finish);
  toggle.addEventListener("pointercancel",finish);

  toggle.addEventListener("click",event=>{
    if(toggle.dataset.dragSuppressClick!=="1")return;
    event.preventDefault();
    event.stopImmediatePropagation();
    delete toggle.dataset.dragSuppressClick;
  },true);
}

function setupEnterToSend(){
  const textarea=document.querySelector("#bcb-copilot-question"),form=document.querySelector("#bcb-copilot-form");
  if(!textarea||!form||textarea.dataset.enterSubmit==="1")return;
  textarea.dataset.enterSubmit="1";
  textarea.addEventListener("keydown",event=>{
    if(event.key!=="Enter"||event.shiftKey||event.isComposing)return;
    event.preventDefault();
    if(textarea.disabled)return;
    form.requestSubmit();
  });
}

function initialize(){
  const widget=getWidget(),toggle=getToggle();
  if(!widget||!toggle)return false;
  if(widget.dataset.dragControls==="1")return true;
  widget.dataset.dragControls="1";
  restorePosition(widget);
  syncEngagedState();
  setupDrag(widget,toggle);
  setupEnterToSend();

  new MutationObserver(syncEngagedState).observe(toggle,{attributes:true,attributeFilter:["aria-expanded"]});
  window.addEventListener("resize",()=>{
    const rect=widget.getBoundingClientRect();
    if(widget.classList.contains("has-custom-position")){
      applyPosition(widget,rect.left,rect.top);
      savePosition(widget);
    }
  },{passive:true});
  return true;
}

if(!initialize()){
  const observer=new MutationObserver(()=>{if(initialize())observer.disconnect();});
  observer.observe(document.body,{childList:true,subtree:true});
}
