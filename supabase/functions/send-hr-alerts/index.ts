import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-bcb-cron-secret","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const fmt=(v:string)=>new Intl.DateTimeFormat('ro-RO',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Bucharest'}).format(new Date(`${v}T12:00:00Z`));
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]||c));

async function sendEmail(apiKey:string,from:string,to:string,subject:string,html:string){
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:to.split(/[;,]/).map(x=>x.trim()).filter(Boolean),subject,html})});
  if(!response.ok)throw new Error(`Resend: ${await response.text()}`);
  return await response.json();
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try{
    const url=Deno.env.get('SUPABASE_URL')!;
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
    const cronSecret=Deno.env.get('FLEET_CRON_SECRET')||'';
    const supplied=req.headers.get('x-bcb-cron-secret')||'';
    const auth=req.headers.get('Authorization')||'';
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});

    if(!(cronSecret&&supplied===cronSecret)){
      const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
      const {data:userData}=await caller.auth.getUser();
      if(!userData.user)return json({error:'Sesiune invalidă.'},401);
      const {data:profile}=await admin.from('profiles').select('role,is_active,is_owner').eq('id',userData.user.id).single();
      if(!profile?.is_active||!(profile.role==='admin'||profile.is_owner))return json({error:'Acces administrativ necesar.'},403);
    }

    const {data:settings,error:settingsError}=await admin.from('hr_alert_settings').select('*').eq('id',true).single();
    if(settingsError)throw settingsError;
    if(!settings.enabled||!settings.report_email)return json({success:true,sent:false,reason:'alerts_disabled_or_no_email'});

    const {data:alerts,error:alertError}=await admin.rpc('get_hr_alerts',{p_days:Number(settings.days_before||30)});
    if(alertError)throw alertError;
    const filtered=(alerts||[]).filter((a:any)=>{
      if(a.alert_type==='contract'&&!settings.include_contracts)return false;
      if(a.alert_type==='document'&&!settings.include_documents)return false;
      if(a.alert_type==='certification'&&!settings.include_certifications)return false;
      if(a.alert_type==='equipment_return'&&!settings.include_equipment_returns)return false;
      return true;
    });
    if(!filtered.length)return json({success:true,sent:false,count:0});

    const keys=filtered.map((a:any)=>`${a.alert_type}:${a.item_id}:${a.due_date}`);
    const since=new Date(Date.now()-7*86400000).toISOString();
    const {data:recent}=await admin.from('hr_alert_log').select('alert_key').in('alert_key',keys).gte('sent_at',since);
    const recentKeys=new Set((recent||[]).map((x:any)=>x.alert_key));
    const fresh=filtered.filter((a:any)=>!recentKeys.has(`${a.alert_type}:${a.item_id}:${a.due_date}`));
    if(!fresh.length)return json({success:true,sent:false,count:0,reason:'already_notified'});

    const labels:any={contract:'Contract',document:'Document',certification:'Autorizație / instruire',equipment_return:'Retur echipament'};
    const rows=fresh.map((a:any)=>`<tr><td style="padding:9px;border-bottom:1px solid #eee"><strong>${esc(a.employee_name)}</strong></td><td style="padding:9px;border-bottom:1px solid #eee">${esc(labels[a.alert_type]||a.alert_type)}</td><td style="padding:9px;border-bottom:1px solid #eee">${esc(a.title)}</td><td style="padding:9px;border-bottom:1px solid #eee">${fmt(a.due_date)}</td><td style="padding:9px;border-bottom:1px solid #eee"><strong>${a.days_left} zile</strong></td></tr>`).join('');
    const html=`<div style="font-family:Arial,sans-serif;color:#20252a;max-width:850px"><h2>BCB Group · People Operations</h2><p>Următoarele elemente HR necesită atenție în perioada următoare:</p><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f4f0e7"><th style="padding:9px;text-align:left">Angajat</th><th style="padding:9px;text-align:left">Tip</th><th style="padding:9px;text-align:left">Element</th><th style="padding:9px;text-align:left">Scadență</th><th style="padding:9px;text-align:left">Rămas</th></tr></thead><tbody>${rows}</tbody></table><p style="margin-top:20px;color:#777;font-size:12px">Mesaj generat automat de BCB Business Manager · People Operations.</p></div>`;

    const apiKey=Deno.env.get('RESEND_API_KEY');
    if(!apiKey)throw new Error('RESEND_API_KEY nu este configurat.');
    const from=Deno.env.get('HR_EMAIL_FROM')||Deno.env.get('FLEET_EMAIL_FROM')||'BCB Group <office@bcbgroup.ro>';
    await sendEmail(apiKey,from,settings.report_email,`BCB HR · ${fresh.length} scadențe necesită atenție`,html);

    await admin.from('hr_alert_log').insert(fresh.map((a:any)=>({alert_key:`${a.alert_type}:${a.item_id}:${a.due_date}`,alert_type:a.alert_type,employee_id:a.employee_id,entity_id:a.item_id,due_date:a.due_date,sent_to:settings.report_email,metadata:{title:a.title,employee_name:a.employee_name,days_left:a.days_left}})));
    return json({success:true,sent:true,count:fresh.length});
  }catch(error){console.error('send-hr-alerts failed',error);return json({error:error instanceof Error?error.message:String(error)},500);}
});
