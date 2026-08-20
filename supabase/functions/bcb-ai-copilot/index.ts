import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const clamp=(value:string,max=1200)=>String(value||"").trim().slice(0,max);

async function count(query:any){
  const {count,error}=await query;
  if(error)throw error;
  return Number(count||0);
}

function localAnswer(question:string,ctx:any){
  const q=question.toLowerCase();
  const lines:string[]=[];
  if(/fleet|maș|mas|curs|vehicul|kilometr/.test(q)){
    lines.push(`Fleet: ${ctx.fleet.activeTrips} curse active, ${ctx.fleet.activeVehicles} vehicule active și ${ctx.fleet.openIncidents} incidente deschise.`);
    if(ctx.fleet.longTrips>0)lines.push(`${ctx.fleet.longTrips} curse active depășesc 3 ore și necesită verificare.`);
  }
  if(/hr|angajat|personal|contract|certific|conced/.test(q))lines.push(`People Operations: ${ctx.hr.activeEmployees} angajați activi și ${ctx.hr.alertsNext30Days} scadențe HR în următoarele 30 de zile.`);
  if(/proiect|lucrare|șantier|santier/.test(q))lines.push(`Proiecte: ${ctx.projects.total} înregistrate, dintre care ${ctx.projects.active} sunt în desfășurare.`);
  if(/alert|aten|urgent|risc|priorit/.test(q)||!lines.length){
    const risks:string[]=[];
    if(ctx.fleet.longTrips)risks.push(`${ctx.fleet.longTrips} curse active prelungite`);
    if(ctx.fleet.openIncidents)risks.push(`${ctx.fleet.openIncidents} incidente Fleet deschise`);
    if(ctx.hr.alertsNext30Days)risks.push(`${ctx.hr.alertsNext30Days} scadențe HR în 30 zile`);
    lines.push(risks.length?`Priorități curente: ${risks.join(", ")}.`:"Nu apar semnale operaționale critice în indicatorii disponibili acum.");
  }
  return lines.join("\n\n");
}

async function askModel(apiKey:string,model:string,question:string,context:any){
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:[{role:"system",content:[{type:"input_text",text:"Ești BCB AI Copilot, asistent operațional intern pentru BCB Group. Răspunde în română, clar, profesionist și orientat spre acțiuni. Folosește exclusiv contextul agregat primit. Nu inventa valori, persoane, documente sau evenimente. Nu oferi acces la date brute și nu sugera operațiuni destructive."}]},{role:"user",content:[{type:"input_text",text:`Întrebare: ${question}\n\nContext operațional agregat:\n${JSON.stringify(context)}`}]}],max_output_tokens:600})});
  if(!response.ok)throw new Error(`AI provider ${response.status}: ${await response.text()}`);
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
    const {data:profile,error:profileError}=await admin.from("profiles").select("id,role,is_active,is_owner").eq("id",userData.user.id).single();
    if(profileError||!profile?.is_active)return json({error:"Cont inactiv sau profil indisponibil."},403);

    const body=await req.json().catch(()=>({}));
    const question=clamp(body?.question||"");
    if(question.length<2)return json({error:"Întrebarea este prea scurtă."},400);

    const privileged=Boolean(profile.is_owner||profile.role==="admin");
    const now=new Date();
    const longTripCutoff=new Date(now.getTime()-3*3600000).toISOString();

    const projectTotalQ=admin.from("projects").select("id",{count:"exact",head:true});
    const projectActiveQ=admin.from("projects").select("id",{count:"exact",head:true}).eq("status","in_progress");
    const activeVehiclesQ=admin.from("fleet_vehicles").select("id",{count:"exact",head:true}).eq("is_active",true);
    let activeTripsQ=admin.from("fleet_trips").select("id",{count:"exact",head:true}).eq("status","active");
    let longTripsQ=admin.from("fleet_trips").select("id",{count:"exact",head:true}).eq("status","active").lt("start_at",longTripCutoff);
    if(!privileged){activeTripsQ=activeTripsQ.eq("driver_id",profile.id);longTripsQ=longTripsQ.eq("driver_id",profile.id);}
    const openIncidentsQ=privileged?admin.from("fleet_incidents").select("id",{count:"exact",head:true}).not("status","in","(resolved,closed)"):Promise.resolve({count:0,error:null});
    const activeEmployeesQ=privileged?admin.from("employees").select("id",{count:"exact",head:true}).eq("employment_status","active"):Promise.resolve({count:0,error:null});

    const [projectsTotal,projectsActive,activeVehicles,activeTrips,longTrips,openIncidents,activeEmployees]=await Promise.all([
      count(projectTotalQ),count(projectActiveQ),count(activeVehiclesQ),count(activeTripsQ),count(longTripsQ),count(openIncidentsQ),count(activeEmployeesQ)
    ]);

    let hrAlerts=0;
    if(privileged){
      const {data:alerts,error:alertsError}=await admin.rpc("get_hr_alerts",{p_days:30});
      if(!alertsError)hrAlerts=(alerts||[]).length;
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
