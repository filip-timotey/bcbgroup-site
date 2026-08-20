window.addEventListener("bcb:copilot-open",event=>{
  const question=String(event.detail?.question||"").trim();
  const toggle=document.querySelector("#bcb-ai-toggle");
  const input=document.querySelector("#bcb-copilot-question");
  const form=document.querySelector("#bcb-copilot-form");
  if(toggle?.getAttribute("aria-expanded")!=="true")toggle?.click();
  if(!question||!input)return;
  input.value=question;
  input.dispatchEvent(new Event("input",{bubbles:true}));
  setTimeout(()=>form?.requestSubmit(),120);
});
