import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const clamp=(value:string,max=1200)=>String(value||"").trim().slice(0,max);

async function countQuery(query:any){const {count,error}=await query.select("id",{count:"exact",head:true});if(error)throw error;return Number(count||0);}

function localAnswer(question:string,ctx:any){
  const q=question.toLowerCase();
  const lines:string[]=[];
  if(/fleet|maș|mas|curs|vehicul|kilometr/.test(q)){
    lines.push(`Fleet: ${ctx.fleet.activeTrips} curse active, ${ctx.fleet.activeVehicles} vehicule active și ${ctx.fleet.openIncidents} incidente deschise.`);
    if(ctx.fleet.longTrips>0)lines.push(`${ctx.fleet.longTrips} curse active depășesc pragul de monitorizare și merită verificate.`);
  }
  if(/hr|angajat|personal|contract|certific|conced/.test(q))lines.push(`People Operations: ${ctx.hr.activeEmployees} angajați activi și ${ctx.hr.alertsNext30Days} scadențe HR în următoarele 30 de zile.`);
  if(/proiect|lucrare|șantier|santier/.test(q))lines.push(`Proiecte: ${ctx.projects.total} înregistrate, dintre care ${ctx.projects.active} sunt în desfășurare.`);
  if(/alert|aten|urgent|risc|priorit/.test(q)||!lines.length){
    const risks=[];
    if(ctx.fleet.longTrips)risks.push(`${ctx.fleet.longTrips} curse active prelungite`);
    if(ctx.fleet.openIncidents)risks.push(`${ctx.fleet.openIncidents} incidente Fleet deschise`);
    if(ctx.hr.alertsNext30Days)risks.push(`${ctx.hr.alertsNext30Days} scadențe HR în 30 zile`);
    lines.push(risks.length?`Priorități curente: ${risks.join(", ")}.`:"Nu apar semnale operaționale critice în indicatorii disponibili acum.");
  }
  return lines.join("\n\n");
}

async function askModel(apiKey:string,model:string,question:string,context:any){
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:[{role:"system",content:[{type:"input_text",text:"Ești BCB AI Copilot, asistent operațional intern pentru BCB Group. Răspunde în română, concis, profesional și orientat spre acțiuni. Folosește exclusiv contextul agregat primit. Nu inventa valori, persoane, documente sau evenimente. Nu oferi acces la date brute și nu sugera modificări destructive."}]},{role:"user",content:[{type:"input_text",text:`Întrebare: ${question}\n\nContext operațional agregat:\n${JSON.stringify(context)}`}]}],max_output_tokens:500})});
  if(!response.ok)throw new Error(`AI provider: ${response.status}`);
  const data=await response.json();
  return String(data.output_text||data.output?.flatMap((x:any)=>x.content||[]).map((x:any)=>x.text||"").join(" ")||"").trim();
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth=req.headers.get("Authorization")||"";
    const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData}=await caller.auth.getUser();
    if(!userData.user)return json({error:"Sesiune invalidă."},401);
    const {data:profile}=await admin.from("profiles").select("id,role,is_active,is_owner").eq("id",userData.user.id).single();
    if(!profile?.is_active)return json({error:"Cont inactiv."},403);
    const body=await req.json().catch(()=>({}));
    const question=clamp(body?.question||"");
    if(question.length<2)return json({error:"Întrebarea este prea scurtă."},400);

    const privileged=Boolean(profile.is_owner||profile.role==="admin");
    const now=new Date();
    const thirtyDays=new Date(now.getTime()+30*86400000).toISOString().slice(0,10);
    const activeTripQuery=admin.from("fleet_trips").eq("status","active");
    const ownOrAll=privileged?activeTripQuery:activeTripQuery.eq("driver_id",profile.id);
    const [projectsTotal,projectsActive,activeVehicles,activeTrips,longTrips,openIncidents,activeEmployees]=await Promise.all([
      countQuery(admin.from("projects")),
      countQuery(admin.from("projects").eq("status","in_progress")),
      countQuery(admin.from("fleet_vehicles").eq("is_active",true)),
      countQuery(ownOrAll),
      countQuery((privileged?admin.from("fleet_trips"):admin.from("fleet_trips").eq("driver_id",profile.id)).eq("status","active").lt("start_at",new Date(now.getTime()-3*3600000).toISOString())),
      privileged?countQuery(admin.from("fleet_incidents").not("status","in","(resolved,closed)")):Promise.resolve(0),
      privileged?countQuery(admin.from("employees").eq("employment_status","active")):Promise.resolve(0)
    ]);

    let hrAlerts=0;
    if(privileged){
      const {data:alerts}=await admin.rpc("get_hr_alerts",{p_days:30});
      hrAlerts=(alerts||[]).filter((x:any)=>x.due_date<=thirtyDays).length;
    }
    const context={scope:privileged?"company":"editor",projects:{total:projectsTotal,active:projectsActive},fleet:{activeVehicles,activeTrips,longTrips,openIncidents},hr:{activeEmployees,alertsNext30Days:hrAlerts},generatedAt:new Date().toISOString()};

    let answer="";let mode="operational";
    const apiKey=Deno.env.get("OPENAI_API_KEY")||"";
    const model=Deno.env.get("OPENAI_MODEL")||"";
    if(apiKey&&model){
      try{answer=await askModel(apiKey,model,question,context);if(answer)mode="ai";}catch(error){console.error("BCB AI provider fallback",error);}
    }
    if(!answer)answer=localAnswer(question,context);
    return json({success:true,answer,mode,context});
  }catch(error){console.error("bcb-ai-copilot failed",error);return json({error:error instanceof Error?error.message:String(error)},500);}
});
