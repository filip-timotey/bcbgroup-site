import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const clean=(v:unknown,n=100)=>String(v??"").trim().slice(0,n);
const todayRo=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Bucharest",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const daysAgo=(n:number)=>new Date(Date.now()-n*86400000).toISOString();
const cap=(value:number,max:number)=>Math.min(max,Math.max(0,value));

type Signal={key:string;severity:"info"|"attention"|"high"|"critical";title:string;detail:string;penalty:number;action:string};

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return out({error:"Method not allowed"},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,auth=req.headers.get("Authorization")||"";
    const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}}),admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const user=(await caller.auth.getUser()).data.user;if(!user)return out({error:"Sesiune invalidă."},401);
    const {data:profile}=await admin.from("profiles").select("id,role,is_active,is_owner").eq("id",user.id).single();
    if(!profile?.is_active||!(["admin","editor"].includes(profile.role)||profile.is_owner))return out({error:"Acces indisponibil."},403);
    const body=await req.json().catch(()=>({})),projectId=clean(body?.project_id,80);if(!projectId)return out({error:"Proiect lipsă."},400);
    const privileged=Boolean(profile.is_owner||profile.role==="admin"),today=todayRo();
    const {data:project,error:projectError}=await admin.from("projects").select("id,title,status,progress,current_stage,planned_start,planned_end,health_status,risk_level").eq("id",projectId).single();
    if(projectError||!project)return out({error:"Proiect inexistent."},404);

    const [tasksR,milestonesR,materialsR,reportsR,timeR,tripsR]=await Promise.all([
      admin.from("project_tasks").select("id,title,status,priority,due_date").eq("project_id",projectId).not("status","in","(done,cancelled)"),
      admin.from("project_milestones").select("id,title,status,target_date").eq("project_id",projectId).not("status","eq","cancelled"),
      admin.from("project_material_requirements").select("id,item_name,status,needed_by,quantity,unit").eq("project_id",projectId).in("status",["needed","ordered"]),
      admin.from("field_daily_reports").select("id,work_date,status,risk_level,issues_notes,work_summary").eq("project_id",projectId).gte("work_date",new Date(Date.now()-30*86400000).toISOString().slice(0,10)).order("work_date",{ascending:false}).limit(50),
      admin.from("employee_time_entries").select("id,work_date,started_at,ended_at,break_minutes,approval_status").eq("project_id",projectId).gte("work_date",new Date(Date.now()-30*86400000).toISOString().slice(0,10)),
      admin.from("fleet_trips").select("id,status,start_at,end_at,distance_km").eq("project_id",projectId).gte("start_at",daysAgo(30))
    ]);
    const tasks=tasksR.data||[],milestones=milestonesR.data||[],materials=materialsR.data||[],reports=reportsR.data||[],time=timeR.data||[],trips=tripsR.data||[];
    const overdueTasks=tasks.filter((x:any)=>x.due_date&&x.due_date<today),blockedTasks=tasks.filter((x:any)=>x.status==="blocked"),urgentTasks=tasks.filter((x:any)=>x.priority==="urgent");
    const delayedMilestones=milestones.filter((x:any)=>x.status==="delayed"||(x.target_date&&x.target_date<today&&x.status!=="completed"));
    const overdueMaterials=materials.filter((x:any)=>x.needed_by&&x.needed_by<today&&x.status!=="delivered");
    const criticalReports=reports.filter((x:any)=>x.risk_level==="critical"&&x.status!=="reviewed"),highReports=reports.filter((x:any)=>x.risk_level==="high"&&x.status!=="reviewed");
    const activeTime=time.filter((x:any)=>x.started_at&&!x.ended_at),pendingTime=time.filter((x:any)=>x.ended_at&&x.approval_status==="draft");
    const activeTrips=trips.filter((x:any)=>x.status==="active"&&!x.end_at),longTrips=activeTrips.filter((x:any)=>Date.now()-new Date(x.start_at).getTime()>12*3600000);
    const workedMinutes=time.reduce((sum:number,x:any)=>{if(!x.started_at)return sum;const end=x.ended_at?new Date(x.ended_at):new Date();return sum+Math.max(0,Math.round((end.getTime()-new Date(x.started_at).getTime())/60000)-Number(x.break_minutes||0));},0);
    const km=trips.reduce((sum:number,x:any)=>sum+Number(x.distance_km||0),0);
    const signals:Signal[]=[];
    const add=(key:Signal["key"],severity:Signal["severity"],title:string,detail:string,penalty:number,action:string)=>signals.push({key,severity,title,detail,penalty,action});
    if(criticalReports.length)add("critical_reports","critical","Risc critic în teren",`${criticalReports.length} raport${criticalReports.length===1?"":"e"} critic${criticalReports.length===1?"":"e"} neverificat${criticalReports.length===1?"":"e"}.`,20,"time.html");
    if(highReports.length)add("high_reports","high","Rapoarte cu risc ridicat",`${highReports.length} raport${highReports.length===1?"":"e"} necesită verificare.`,cap(highReports.length*8,20),"time.html");
    if(blockedTasks.length)add("blocked_tasks","high","Task-uri blocate",`${blockedTasks.length} acțiuni sunt marcate Blocat.`,cap(blockedTasks.length*8,20),"project.html");
    if(overdueTasks.length)add("overdue_tasks","attention","Task-uri întârziate",`${overdueTasks.length} task-uri au termenul depășit.`,cap(overdueTasks.length*5,20),"project.html");
    if(delayedMilestones.length)add("delayed_milestones","high","Repere întârziate",`${delayedMilestones.length} reper${delayedMilestones.length===1?"":"e"} necesită replanificare.`,cap(delayedMilestones.length*8,20),"project.html");
    if(overdueMaterials.length)add("overdue_materials","attention","Materiale restante",`${overdueMaterials.length} necesar${overdueMaterials.length===1?"":"e"} de materiale a depășit data necesară.`,cap(overdueMaterials.length*4,16),"project.html");
    if(urgentTasks.length)add("urgent_tasks","attention","Priorități urgente",`${urgentTasks.length} task-uri urgente sunt încă deschise.`,cap(urgentTasks.length*3,12),"project.html");
    if(longTrips.length)add("long_trips","attention","Cursă Fleet foarte lungă",`${longTrips.length} cursă${longTrips.length===1?"":"e"} activă de peste 12 ore.`,cap(longTrips.length*5,10),"fleet.html");
    if(project.planned_end&&project.planned_end<today&&Number(project.progress||0)<100)add("project_deadline","high","Termen proiect depășit",`Finalizarea planificată a trecut, progres curent ${Number(project.progress||0)}%.`,15,"project.html");

    let financial:any=null;
    if(privileged){
      const [{data:fin},{data:cost}]=await Promise.all([admin.from("project_financials").select("budget_estimated,contract_value,contingency_amount,currency,include_tracked_labor").eq("project_id",projectId).maybeSingle(),admin.from("project_cost_summary").select("approved_cost,pending_cost,pending_entries,material_cost,labor_cost,fuel_cost").eq("project_id",projectId).maybeSingle()]);
      if(fin||cost){const approved=Number(cost?.approved_cost||0),pending=Number(cost?.pending_cost||0),budget=Number(fin?.budget_estimated||0),contract=Number(fin?.contract_value||0),exposure=approved+pending,base=budget||contract||0,ratio=base>0?exposure/base:null;financial={currency:fin?.currency||"RON",budget,contract,approved_cost:approved,pending_cost:pending,pending_entries:Number(cost?.pending_entries||0),exposure_ratio:ratio,include_tracked_labor:Boolean(fin?.include_tracked_labor)};if(ratio!==null&&ratio>1)add("budget_overrun","critical","Expunere peste buget",`Cost aprobat + în așteptare este ${(ratio*100).toFixed(0)}% din baza financiară.`,20,"project.html");else if(ratio!==null&&ratio>=.85)add("budget_pressure","high","Presiune pe buget",`Expunerea a ajuns la ${(ratio*100).toFixed(0)}% din baza financiară.`,10,"project.html");if(Number(cost?.pending_entries||0)>5)add("pending_costs","attention","Costuri în așteptare",`${Number(cost?.pending_entries||0)} înregistrări financiare așteaptă validare.`,5,"project.html");}
    }

    let score=100-signals.reduce((sum,s)=>sum+s.penalty,0);score=Math.max(0,Math.min(100,score));
    const hasCritical=signals.some(s=>s.severity==="critical"),hasBlocking=criticalReports.length>0||blockedTasks.length>=3;
    const status=hasCritical||hasBlocking||score<50?"blocked":score<70?"at_risk":score<85?"attention":"healthy";
    const summary={open_tasks:tasks.length,overdue_tasks:overdueTasks.length,blocked_tasks:blockedTasks.length,urgent_tasks:urgentTasks.length,delayed_milestones:delayedMilestones.length,open_material_needs:materials.length,overdue_materials:overdueMaterials.length,high_reports:highReports.length,critical_reports:criticalReports.length,active_workers:activeTime.length,pending_time_approval:pendingTime.length,worked_hours_30d:Math.round(workedMinutes/6)/10,active_trips:activeTrips.length,fleet_km_30d:Math.round(km)};
    const snapshotSignals={summary,signals:signals.map(({key,severity,title,detail,penalty})=>({key,severity,title,detail,penalty})),manual_health:project.health_status,manual_risk:project.risk_level,financial:privileged?financial:undefined};
    if(privileged){await admin.from("project_health_snapshots").upsert({project_id:projectId,snapshot_date:today,score,status,signals:snapshotSignals,generated_by:user.id,updated_at:new Date().toISOString()},{onConflict:"project_id,snapshot_date"});}
    const {data:history}=await admin.from("project_health_snapshots").select("snapshot_date,score,status").eq("project_id",projectId).order("snapshot_date",{ascending:false}).limit(14);
    return out({success:true,project:{id:project.id,title:project.title,status:project.status,progress:project.progress,current_stage:project.current_stage,planned_start:project.planned_start,planned_end:project.planned_end,manual_health:project.health_status,manual_risk:project.risk_level},health:{score,status,signals,summary,trend:(history||[]).reverse(),financial:privileged?financial:null,calculated_at:new Date().toISOString()},permissions:{role:profile.is_owner?"owner":profile.role,finance:privileged,can_manage:privileged}});
  }catch(error){console.error("bcb-project-health",error);return out({error:error instanceof Error?error.message:String(error)},500);}
});
