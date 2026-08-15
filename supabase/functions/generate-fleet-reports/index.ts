import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bcb-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers:{...corsHeaders,"Content-Type":"application/json"} });
const safe = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ș/g,"s").replace(/Ș/g,"S").replace(/ț/g,"t").replace(/Ț/g,"T");
const fmtDate = (d: string) => new Intl.DateTimeFormat("ro-RO",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Europe/Bucharest"}).format(new Date(d));
const fmtTime = (d: string) => new Intl.DateTimeFormat("ro-RO",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Europe/Bucharest"}).format(new Date(d));
const monthName = (m:number) => ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"][m-1] || String(m);

function period(year:number, month:number){ const start=new Date(Date.UTC(year,month-1,1)); const end=new Date(Date.UTC(year,month,1)); return [start.toISOString(),end.toISOString()]; }
function reportNo(year:number,month:number,registration:string,driverId:string){ return `FP-${year}-${String(month).padStart(2,"0")}-${registration.replace(/\s+/g,"")}-${driverId.slice(0,6).toUpperCase()}`; }

async function buildPdf({vehicle,driver,trips,fuel,settings,year,month,number}:{vehicle:any,driver:any,trips:any[],fuel:any[],settings:any,year:number,month:number,number:string}){
  const pdf=await PDFDocument.create();
  const page=pdf.addPage([841.89,595.28]);
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const W=page.getWidth(), H=page.getHeight();
  const draw=(text:string,x:number,y:number,size=8,b=false,color=rgb(.12,.14,.16))=>page.drawText(safe(text),{x,y,size,font:b?bold:font,color});
  const line=(x1:number,y1:number,x2:number,y2:number,w=.6,color=rgb(.45,.48,.5))=>page.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},thickness:w,color});
  const box=(x:number,y:number,w:number,h:number,fill?:any)=>page.drawRectangle({x,y,width:w,height:h,borderWidth:.65,borderColor:rgb(.45,.48,.5),color:fill});

  draw(settings.company_header_name||"BCB Group",32,H-35,12,true); draw(settings.company_legal_name||"BCB Construct Pro S.R.L.",32,H-49,8,true);
  draw(`CUI: ${settings.company_cui||""}`,32,H-63,7); draw(`Nr. Reg. Com.: ${settings.company_register||""}`,32,H-74,7); draw(`Sediu: ${settings.company_address||""}`,32,H-85,7); draw(`Telefon: ${settings.company_phone||""}`,32,H-96,7); draw(`Email: ${settings.company_email||""}`,32,H-107,7);
  draw("DOCUMENT INTERN",W/2-34,H-38,6); draw("FOAIE DE PARCURS",W/2-86,H-61,17,true); draw(`${monthName(month)} ${year}`,W/2-34,H-78,9,true);
  draw("Serie / Numar",W-112,H-38,6); draw(number,W-112,H-56,10,true); line(28,H-115,W-28,H-115,1.2,rgb(.15,.18,.2));

  const topY=H-170, infoH=42, cellW=(W-56)/4;
  [["Vehicul",`${vehicle.make} ${vehicle.model}`],["Nr. de inmatriculare",vehicle.registration_number],["Conducator auto",driver.email||driver.full_name||""],["Combustibil",vehicle.fuel_type]].forEach((it,i)=>{ const x=28+i*cellW; box(x,topY,cellW,infoH); draw(it[0],x+7,topY+28,6); draw(it[1],x+7,topY+11,8,true); });

  const cols=[30,64,78,82,116,64,64,78,78,72]; const headers=["Nr.","Data","Plecare","Destinatie","Scop","Ora plecare","Ora sosire","Km plecare","Km sosire","Km parcurs"];
  let y=topY-40, x=28; const headerH=25;
  headers.forEach((h,i)=>{box(x,y,cols[i],headerH,rgb(.88,.91,.94));draw(h,x+4,y+9,5.5,true);x+=cols[i]});
  y-=headerH;
  const rowH=22; const maxRows=13; const rows=trips.slice(0,maxRows);
  rows.forEach((t,idx)=>{x=28;const data=[idx+1,fmtDate(t.start_at),t.origin||"",t.destination||"",t.purpose||"",fmtTime(t.start_at),t.end_at?fmtTime(t.end_at):"",Number(t.start_odometer||0).toLocaleString("ro-RO"),Number(t.end_odometer||0).toLocaleString("ro-RO"),Number(t.distance_km||0).toLocaleString("ro-RO")];data.forEach((v,i)=>{box(x,y,cols[i],rowH);draw(String(v).slice(0,i===4?25:16),x+4,y+8,5.5,i===9);x+=cols[i]});y-=rowH;});

  const totalKm=trips.reduce((a,t)=>a+Number(t.distance_km||0),0); const totalFuel=fuel.reduce((a,f)=>a+Number(f.liters||0),0);
  const summaryY=72, summaryW=(W-56)/3; [["Curse finalizate",String(trips.length)],["Total kilometri",`${totalKm.toLocaleString("ro-RO")} km`],["Total alimentare",`${totalFuel.toLocaleString("ro-RO")} L`]].forEach((it,i)=>{const sx=28+i*summaryW;box(sx,summaryY,summaryW,38);draw(it[0],sx+8,summaryY+25,6);draw(it[1],sx+8,summaryY+9,10,true)});
  draw("Conducator auto",28,42,6);draw(driver.email||driver.full_name||"",28,24,8,true);line(28,12,270,12,.6);draw("Verificat / Aprobat",450,42,6);draw(settings.approved_by||"",450,24,8,true);line(450,12,W-28,12,.6);
  return await pdf.save();
}

function buildXlsx({vehicle,driver,trips,fuel,settings,year,month,number}:{vehicle:any,driver:any,trips:any[],fuel:any[],settings:any,year:number,month:number,number:string}){
  const rows=trips.map((t,i)=>({Nr:i+1,Data:fmtDate(t.start_at),Plecare:t.origin||"",Destinatie:t.destination||"",Scop:t.purpose||"","Ora plecare":fmtTime(t.start_at),"Ora sosire":t.end_at?fmtTime(t.end_at):"","Km plecare":Number(t.start_odometer||0),"Km sosire":Number(t.end_odometer||0),"Km parcurs":Number(t.distance_km||0)}));
  const wb=XLSX.utils.book_new(); const ws=XLSX.utils.json_to_sheet(rows,{origin:"A8"});
  XLSX.utils.sheet_add_aoa(ws,[
    [settings.company_header_name||"BCB Group",settings.company_legal_name||"BCB Construct Pro S.R.L.","FOAIE DE PARCURS",number],
    ["Perioada",`${monthName(month)} ${year}`,"Vehicul",`${vehicle.make} ${vehicle.model}`],
    ["Nr. inmatriculare",vehicle.registration_number,"Conducator auto",driver.email||driver.full_name||""],
    ["Combustibil",vehicle.fuel_type,"Km total",trips.reduce((a,t)=>a+Number(t.distance_km||0),0)],
    ["Alimentare total",fuel.reduce((a,f)=>a+Number(f.liters||0),0),"Litri",""],
    [],[]
  ],{origin:"A1"});
  ws["!cols"]=[{wch:5},{wch:12},{wch:18},{wch:20},{wch:28},{wch:13},{wch:13},{wch:13},{wch:13},{wch:13}];
  XLSX.utils.book_append_sheet(wb,ws,"Foaie parcurs");
  const fs=XLSX.utils.json_to_sheet(fuel.map(f=>({Data:fmtDate(f.fueled_at),Litri:Number(f.liters),Valoare:f.total_amount?Number(f.total_amount):"",Kilometraj:f.odometer?Number(f.odometer):"",Statie:f.station||""}))); XLSX.utils.book_append_sheet(wb,fs,"Alimentari");
  return XLSX.write(wb,{bookType:"xlsx",type:"array"}) as ArrayBuffer;
}

async function sendEmail(apiKey:string,from:string,to:string,cc:string|undefined,subject:string,html:string,attachments:any[]){
  const payload:any={from,to:to.split(/[;,]/).map(x=>x.trim()).filter(Boolean),subject,html,attachments}; if(cc)payload.cc=cc.split(/[;,]/).map(x=>x.trim()).filter(Boolean);
  const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify(payload)}); if(!res.ok)throw new Error(`Resend: ${await res.text()}`); return await res.json();
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")!; const anon=Deno.env.get("SUPABASE_ANON_KEY")!; const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; const cronSecret=Deno.env.get("FLEET_CRON_SECRET")||"";
    const auth=req.headers.get("Authorization")||""; const suppliedCron=req.headers.get("x-bcb-cron-secret")||"";
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    let callerId:string|null=null;
    if(!(cronSecret && suppliedCron===cronSecret)){
      const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}}); const {data:u}=await caller.auth.getUser(); if(!u.user)return json({error:"Sesiune invalida"},401); callerId=u.user.id;
      const {data:p}=await admin.from("profiles").select("role,is_active").eq("id",callerId).single(); if(!p?.is_active||p.role!=="admin")return json({error:"Doar administratorii pot genera rapoarte."},403);
    }
    const body=await req.json().catch(()=>({})); const now=new Date(); const prev=new Date(now.getFullYear(),now.getMonth()-1,1); const year=Number(body.year||prev.getFullYear()); const month=Number(body.month||prev.getMonth()+1); if(month<1||month>12)return json({error:"Luna invalida"},400);
    const [start,end]=period(year,month);
    const [{data:vehicles},{data:trips,error:tErr},{data:fuel},{data:profileRows},{data:settings}]=await Promise.all([
      admin.from("fleet_vehicles").select("*").eq("is_active",true),
      admin.from("fleet_trips").select("*").gte("start_at",start).lt("start_at",end).eq("status","completed").order("start_at"),
      admin.from("fleet_fuel_entries").select("*").gte("fueled_at",start).lt("fueled_at",end),
      admin.from("profiles").select("id,full_name,email"),
      admin.from("fleet_settings").select("*").eq("id",true).single()
    ]); if(tErr)throw tErr;
    const profiles=new Map((profileRows||[]).map((p:any)=>[p.id,p])); let generated=0; const emailAttachments:any[]=[];
    for(const vehicle of vehicles||[]){ const vt=(trips||[]).filter((t:any)=>t.vehicle_id===vehicle.id); const drivers=[...new Set(vt.map((t:any)=>t.driver_id))]; for(const driverId of drivers){ const driver=profiles.get(driverId)||{id:driverId,full_name:"Sofer",email:""}; const dt=vt.filter((t:any)=>t.driver_id===driverId); const vf=(fuel||[]).filter((f:any)=>f.vehicle_id===vehicle.id&&(!f.driver_id||f.driver_id===driverId)); const number=reportNo(year,month,vehicle.registration_number,driverId as string); const pdfBytes=await buildPdf({vehicle,driver,trips:dt,fuel:vf,settings,year,month,number}); const xlsxBytes=new Uint8Array(buildXlsx({vehicle,driver,trips:dt,fuel:vf,settings,year,month,number})); const base=`${year}/${String(month).padStart(2,"0")}/${vehicle.registration_number.replace(/\s+/g,"-")}/${driverId}`; const pdfPath=`${base}/${number}.pdf`; const xlsxPath=`${base}/${number}.xlsx`;
      const up1=await admin.storage.from("fleet-reports").upload(pdfPath,pdfBytes,{contentType:"application/pdf",upsert:true}); if(up1.error)throw up1.error; const up2=await admin.storage.from("fleet-reports").upload(xlsxPath,xlsxBytes,{contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",upsert:true}); if(up2.error)throw up2.error;
      const totalKm=dt.reduce((a:number,t:any)=>a+Number(t.distance_km||0),0), totalFuel=vf.reduce((a:number,f:any)=>a+Number(f.liters||0),0);
      await admin.from("fleet_reports").upsert({vehicle_id:vehicle.id,report_year:year,report_month:month,report_number:number,driver_id:driverId,total_trips:dt.length,total_km:totalKm,total_fuel_liters:totalFuel,pdf_path:pdfPath,xlsx_path:xlsxPath,generated_at:new Date().toISOString(),generated_by:callerId,status:"generated",error_message:null},{onConflict:"vehicle_id,report_year,report_month,driver_id"});
      emailAttachments.push({filename:`${number}.pdf`,content:btoa(String.fromCharCode(...pdfBytes))},{filename:`${number}.xlsx`,content:btoa(String.fromCharCode(...xlsxBytes))}); generated++;
    }}
    const shouldEmail=Boolean(body.send_email ?? settings.auto_email); let emailed=false;
    if(shouldEmail&&settings.report_email&&emailAttachments.length){ const key=Deno.env.get("RESEND_API_KEY"); const from=Deno.env.get("FLEET_EMAIL_FROM")||"BCB Fleet <fleet@bcbgroup.ro>"; if(!key)throw new Error("RESEND_API_KEY nu este configurat."); await sendEmail(key,from,settings.report_email,settings.report_cc||undefined,`BCB Fleet · Foi de parcurs · ${monthName(month)} ${year}`,`<div style="font-family:Arial,sans-serif"><h2>BCB Group · Fleet Management</h2><p>Atasat gasesti foile de parcurs pentru <strong>${monthName(month)} ${year}</strong>, generate automat separat pe vehicul si conducator auto.</p><p>Document generat de BCB Business Manager.</p></div>`,emailAttachments); await admin.from("fleet_reports").update({emailed_at:new Date().toISOString(),status:"emailed"}).eq("report_year",year).eq("report_month",month); emailed=true; }
    return json({success:true,year,month,generated,emailed});
  }catch(error){console.error(error);return json({error:error instanceof Error?error.message:"Eroare interna la generarea rapoartelor Fleet."},500)}
});