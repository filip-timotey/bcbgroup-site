import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const clean=(v:unknown,n=100)=>String(v??"").trim().slice(0,n);

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return out({error:"Method not allowed"},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,auth=req.headers.get("Authorization")||"";
    const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}}),admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const user=(await caller.auth.getUser()).data.user;if(!user)return out({error:"Sesiune invalidă."},401);
    const {data:profile}=await admin.from("profiles").select("id,role,is_active,is_owner").eq("id",user.id).single();if(!profile?.is_active||!(["admin","editor"].includes(profile.role)||profile.is_owner))return out({error:"Acces indisponibil."},403);
    const body=await req.json().catch(()=>({})),action=clean(body?.action,40);
    if(action==="finalize_report"){
      const reportId=clean(body?.report_id,80);if(!reportId)return out({error:"Raport lipsă."},400);
      const {data:report}=await admin.from("field_daily_reports").select("id,created_by,status").eq("id",reportId).single();if(!report)return out({error:"Raport inexistent."},404);
      const privileged=Boolean(profile.is_owner||profile.role==="admin");if(report.created_by!==user.id&&!privileged)return out({error:"Acces interzis."},403);
      const {data,error}=await admin.rpc("finalize_field_daily_report_service",{p_report_id:reportId,p_actor_id:user.id});if(error)throw error;return out({success:true,result:data});
    }
    if(action==="review_suggestion"){
      if(!(profile.is_owner||profile.role==="admin"))return out({error:"Doar Owner/Admin poate valida propuneri."},403);
      const suggestionId=clean(body?.suggestion_id,80),decision=clean(body?.decision,20);if(!suggestionId||!["accepted","rejected"].includes(decision))return out({error:"Payload invalid."},400);
      const {data,error}=await admin.rpc("review_field_report_suggestion_service",{p_suggestion_id:suggestionId,p_decision:decision,p_actor_id:user.id});if(error)throw error;return out({success:true,result:data});
    }
    return out({error:"Acțiune invalidă."},400);
  }catch(error){console.error("bcb-field-report-actions",error);return out({error:error instanceof Error?error.message:String(error)},500);}
});
