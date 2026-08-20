import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const allowedOrigins=new Set(["https://bcbgroup.ro","https://www.bcbgroup.ro","http://localhost:5500","http://127.0.0.1:5500"]);
const VAPID_PUBLIC_KEY="BMPBotjiGHzbuPZTSEcuyrryp00xt9BLdQPzAn9dcEvYbRkNTVj-QmQnPOXYlhb69-TA26GypXdjLiJTi0IhWLU";
const clean=(value:unknown,max=500)=>String(value??"").trim().slice(0,max);
const esc=(value:unknown)=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]||c));

function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  const allowed=!origin||allowedOrigins.has(origin);
  return {allowed,headers:{"Access-Control-Allow-Origin":origin&&allowed?origin:"https://bcbgroup.ro","Vary":"Origin","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"}};
}
function json(req:Request,body:unknown,status=200){const c=cors(req);return new Response(JSON.stringify(body),{status,headers:{...c.headers,"Content-Type":"application/json","Cache-Control":"no-store"}});}
function normalizePhone(value:string){return value.replace(/[^0-9+]/g,"").slice(0,24);}
function validEmail(value:string){return !value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}

async function sendEmail(payload:any){
  const apiKey=Deno.env.get("RESEND_API_KEY")||"";if(!apiKey)return false;
  const to=(Deno.env.get("CRM_NOTIFY_EMAIL")||"office@bcbgroup.ro").split(/[;,]/).map(x=>x.trim()).filter(Boolean);
  const from=Deno.env.get("CRM_EMAIL_FROM")||"BCB Group <office@bcbgroup.ro>";
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from,to,subject:`BCB CRM · Lead nou · ${payload.full_name}`,html:`<div style="font-family:Arial,sans-serif;color:#1d2227;max-width:680px"><h2>BCB Group · Lead nou</h2><p>A intrat o solicitare nouă de pe site.</p><table style="width:100%;border-collapse:collapse;background:#f7f4ed"><tr><td style="padding:9px"><strong>Client</strong></td><td style="padding:9px">${esc(payload.full_name)}</td></tr><tr><td style="padding:9px"><strong>Telefon</strong></td><td style="padding:9px">${esc(payload.phone)}</td></tr><tr><td style="padding:9px"><strong>Tip proiect</strong></td><td style="padding:9px">${esc(payload.project_type||"—")}</td></tr><tr><td style="padding:9px"><strong>Locație</strong></td><td style="padding:9px">${esc(payload.location||"—")}</td></tr><tr><td style="padding:9px"><strong>Buget</strong></td><td style="padding:9px">${esc(payload.estimated_budget||"—")}</td></tr></table><p style="margin-top:16px">${esc(payload.message)}</p><p style="font-size:12px;color:#777">Deschide BCB Business Manager → CRM pentru follow-up.</p></div>`})});
  if(!response.ok){console.error("CRM Resend",response.status,await response.text());return false;}return true;
}

async function sendAdminPush(admin:any,lead:any){
  try{
    const {data:secret,error:secretError}=await admin.rpc("get_bcb_web_push_vapid_private_key");
    if(secretError||!secret)return 0;
    webpush.setVapidDetails("mailto:office@bcbgroup.ro",VAPID_PUBLIC_KEY,String(secret));
    const {data:profiles}=await admin.from("profiles").select("id").eq("is_active",true).or("is_owner.eq.true,role.eq.admin");
    const ids=(profiles||[]).map((p:any)=>p.id);if(!ids.length)return 0;
    const {data:subs}=await admin.from("web_push_subscriptions").select("id,endpoint,p256dh,auth").in("user_id",ids).eq("is_active",true);
    let sent=0;
    const body=[lead.full_name,lead.project_type,lead.location].filter(Boolean).join(" · ");
    const notification=JSON.stringify({type:"crm_lead_new",tag:`bcb-crm-lead-${lead.id}`,title:"BCB CRM · Lead nou",body,url:`/admin/quotes.html?lead=${encodeURIComponent(lead.id)}`,requireInteraction:true,silent:false});
    for(const sub of subs||[]){
      try{await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},notification,{TTL:86400,urgency:"high"});sent++;}
      catch(error:any){const status=Number(error?.statusCode||error?.status||0);if(status===404||status===410)await admin.from("web_push_subscriptions").update({is_active:false}).eq("id",sub.id);else console.error("CRM web push",status,error?.message||error);}
    }
    return sent;
  }catch(error){console.error("CRM push unavailable",error);return 0;}
}

Deno.serve(async(req)=>{
  const c=cors(req);if(req.method==="OPTIONS")return new Response("ok",{status:c.allowed?200:403,headers:c.headers});
  if(!c.allowed)return json(req,{error:"Origin not allowed"},403);
  if(req.method!=="POST")return json(req,{error:"Method not allowed"},405);
  try{
    const body=await req.json().catch(()=>({}));
    if(clean(body?.website,200))return json(req,{success:true}); // honeypot: silent success
    const payload={
      external_request_id:clean(body?.external_request_id,40)||null,
      full_name:clean(body?.full_name,120),phone:normalizePhone(clean(body?.phone,40)),email:clean(body?.email,160)||null,
      location:clean(body?.location,160)||null,project_type:clean(body?.project_type,160)||null,estimated_budget:clean(body?.estimated_budget,100)||null,
      desired_start:clean(body?.desired_start,100)||null,project_stage:clean(body?.project_stage,160)||null,message:clean(body?.message,3000),status:"new",source:"website"
    };
    if(payload.full_name.length<2||payload.phone.replace(/\D/g,"").length<7||payload.message.length<10)return json(req,{error:"Datele solicitării sunt incomplete."},400);
    if(!validEmail(payload.email||""))return json(req,{error:"Adresa de email nu este validă."},400);
    if(payload.external_request_id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.external_request_id))payload.external_request_id=null;

    const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});

    if(payload.external_request_id){
      const {data:existing}=await admin.from("quote_requests").select("id,lead_score").eq("external_request_id",payload.external_request_id).maybeSingle();
      if(existing)return json(req,{success:true,id:existing.id,lead_score:existing.lead_score,deduplicated:true});
    }
    const cutoff=new Date(Date.now()-2*60*1000).toISOString();
    const {data:recent}=await admin.from("quote_requests").select("id,lead_score").eq("phone",payload.phone).eq("message",payload.message).gte("created_at",cutoff).limit(1).maybeSingle();
    if(recent)return json(req,{success:true,id:recent.id,lead_score:recent.lead_score,deduplicated:true});

    const {data:lead,error}=await admin.from("quote_requests").insert(payload).select("id,full_name,phone,email,location,project_type,estimated_budget,desired_start,project_stage,message,lead_score").single();
    if(error){if(error.code==="23505"&&payload.external_request_id){const {data:existing}=await admin.from("quote_requests").select("id,lead_score").eq("external_request_id",payload.external_request_id).single();return json(req,{success:true,id:existing?.id,lead_score:existing?.lead_score,deduplicated:true});}throw error;}
    const [emailSent,pushSent]=await Promise.all([sendEmail(lead).catch(()=>false),sendAdminPush(admin,lead)]);
    return json(req,{success:true,id:lead.id,lead_score:lead.lead_score,emailSent,pushSent});
  }catch(error){console.error("submit-quote-request failed",error);return json(req,{error:"Solicitarea nu a putut fi înregistrată momentan."},500);}
});
