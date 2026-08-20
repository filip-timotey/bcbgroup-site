import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const PUBLIC_KEY="BMPBotjiGHzbuPZTSEcuyrryp00xt9BLdQPzAn9dcEvYbRkNTVj-QmQnPOXYlhb69-TA26GypXdjLiJTi0IhWLU";

async function sendPush(admin:any,userId:string,payload:Record<string,unknown>){
  const {data:secret,error:secretError}=await admin.rpc("get_bcb_web_push_vapid_private_key");if(secretError||!secret)throw secretError||new Error("VAPID private key missing");
  webpush.setVapidDetails("mailto:office@bcbgroup.ro",PUBLIC_KEY,String(secret));
  const {data:subs,error}=await admin.from("web_push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id",userId).eq("is_active",true);if(error)throw error;
  let sent=0;for(const sub of subs||[]){try{await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify(payload),{TTL:3600,urgency:"high"});sent++;}catch(error:any){const status=Number(error?.statusCode||error?.status||0);if(status===404||status===410)await admin.from("web_push_subscriptions").update({is_active:false}).eq("id",sub.id);else console.error("fleet-trip-push delivery",status,error?.message||error);}}
  return sent;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,auth=req.headers.get("Authorization")||"";
    const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}}),admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData}=await caller.auth.getUser();if(!userData.user)return json({error:"Sesiune invalidă."},401);
    const {data:profile}=await admin.from("profiles").select("id,role,is_active,is_owner").eq("id",userData.user.id).single();if(!profile?.is_active)return json({error:"Cont inactiv."},403);
    const body=await req.json().catch(()=>({})),action=String(body?.action||""),tripId=String(body?.trip_id||"");if(!["start","stop","refresh"].includes(action)||!tripId)return json({error:"Payload invalid."},400);
    const {data:trip,error:tripError}=await admin.from("fleet_trips").select("id,driver_id,start_at,end_at,status,origin,destination,purpose,vehicle_id,fleet_vehicles(registration_number,make,model)").eq("id",tripId).single();if(tripError||!trip)return json({error:"Cursa nu există."},404);
    const privileged=Boolean(profile.is_owner||profile.role==="admin");if(trip.driver_id!==profile.id&&!privileged)return json({error:"Acces interzis."},403);
    const vehicle:any=Array.isArray(trip.fleet_vehicles)?trip.fleet_vehicles[0]:trip.fleet_vehicles,label=[vehicle?.registration_number,vehicle?.make,vehicle?.model].filter(Boolean).join(" · ")||"Vehicul BCB",route=[trip.origin,trip.destination].filter(Boolean).join(" → ")||trip.purpose||"Deplasare BCB",active=action!=="stop"&&trip.status==="active"&&!trip.end_at;
    const payload=active?{type:"fleet_trip_active",tripId:trip.id,tag:`bcb-fleet-trip-${trip.id}`,title:"BCB Fleet · Cursă activă",body:`${label} · ${route} · Atinge pentru Quick Stop.`,url:`/admin/fleet.html?quickStop=${encodeURIComponent(trip.id)}`,silent:false,requireInteraction:true}:{type:"fleet_trip_stop",tripId:trip.id,tag:`bcb-fleet-trip-${trip.id}`,title:"BCB Fleet · Cursă încheiată",body:`${label} · cursa a fost închisă corect.`,url:"/admin/fleet.html",silent:true};
    const sent=await sendPush(admin,trip.driver_id,payload);return json({success:true,sent,active});
  }catch(error){console.error("fleet-trip-push failed",error);return json({error:error instanceof Error?error.message:String(error)},500);}
});