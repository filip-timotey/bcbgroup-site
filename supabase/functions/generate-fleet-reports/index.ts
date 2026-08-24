import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bcb-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const safe = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ș/g, "s")
    .replace(/Ș/g, "S")
    .replace(/ț/g, "t")
    .replace(/Ț/g, "T");

const fmtDate = (value: string) =>
  new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  }).format(new Date(value));

const fmtTime = (value: string) =>
  new Intl.DateTimeFormat("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Bucharest",
  }).format(new Date(value));

const fmtNumber = (value: unknown, max = 1) =>
  Number(value || 0).toLocaleString("ro-RO", { maximumFractionDigits: max });

const monthName = (month: number) =>
  [
    "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
    "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
  ][month - 1] || String(month);

function period(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return [start.toISOString(), end.toISOString()];
}

function reportNo(year: number, month: number, registration: string) {
  return `FP-${year}-${String(month).padStart(2, "0")}-${registration.replace(/\s+/g, "").toUpperCase()}`;
}

function driverDisplay(profile: any) {
  const fullName = String(profile?.full_name || "").trim();
  if (fullName) return fullName;
  return "Conducator auto";
}

function tripFuel(fuel: any[], tripId: string) {
  const rows = fuel.filter((entry: any) => entry.trip_id === tripId);
  return {
    liters: rows.reduce((sum: number, entry: any) => sum + Number(entry.liters || 0), 0),
    amount: rows.reduce((sum: number, entry: any) => sum + Number(entry.total_amount || 0), 0),
    count: rows.length,
  };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

async function buildPdf({ vehicle, trips, fuel, settings, profiles, year, month, number }: any) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [841.89, 595.28];
  const rowsPerPage = 11;
  const pageCount = Math.max(1, Math.ceil(trips.length / rowsPerPage));
  const totalKm = trips.reduce((sum: number, trip: any) => sum + Number(trip.distance_km || 0), 0);
  const totalFuel = fuel.reduce((sum: number, entry: any) => sum + Number(entry.liters || 0), 0);
  const totalFuelAmount = fuel.reduce((sum: number, entry: any) => sum + Number(entry.total_amount || 0), 0);
  const driverNames = [...new Set(trips.map((trip: any) => driverDisplay(profiles.get(trip.driver_id))))];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const page = pdf.addPage(pageSize);
    const W = page.getWidth();
    const H = page.getHeight();
    const isLast = pageIndex === pageCount - 1;
    const pageTrips = trips.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);

    const draw = (text: unknown, x: number, y: number, size = 8, isBold = false, color = rgb(.12, .14, .16)) =>
      page.drawText(safe(text), { x, y, size, font: isBold ? bold : font, color });
    const line = (x1: number, y1: number, x2: number, y2: number, width = .6, color = rgb(.45, .48, .5)) =>
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: width, color });
    const box = (x: number, y: number, w: number, h: number, fill?: any) =>
      page.drawRectangle({ x, y, width: w, height: h, borderWidth: .65, borderColor: rgb(.45, .48, .5), color: fill });

    draw(settings.company_header_name || "BCB Group", 32, H - 35, 12, true);
    draw(settings.company_legal_name || "BCB Construct Pro S.R.L.", 32, H - 49, 8, true);
    draw(`CUI: ${settings.company_cui || ""}`, 32, H - 63, 7);
    draw(`Nr. Reg. Com.: ${settings.company_register || ""}`, 32, H - 74, 7);
    draw(`Sediu: ${settings.company_address || ""}`, 32, H - 85, 7);
    draw(`Telefon: ${settings.company_phone || ""}`, 32, H - 96, 7);
    draw(`Email: ${settings.company_email || ""}`, 32, H - 107, 7);

    draw("DOCUMENT INTERN", W / 2 - 34, H - 38, 6);
    draw("FOAIE DE PARCURS", W / 2 - 86, H - 61, 17, true);
    draw(`${monthName(month)} ${year}`, W / 2 - 34, H - 78, 9, true);
    draw("Serie / Numar", W - 145, H - 38, 6);
    draw(number, W - 145, H - 56, 8.5, true);
    line(28, H - 115, W - 28, H - 115, 1.2, rgb(.15, .18, .2));

    const topY = H - 170;
    const infoH = 42;
    const cellW = (W - 56) / 4;
    const driversHeader = driverNames.length <= 2
      ? driverNames.join(" / ")
      : `${driverNames.length} conducatori auto`;

    [
      ["Vehicul", `${vehicle.make} ${vehicle.model}`],
      ["Nr. de inmatriculare", vehicle.registration_number],
      ["Conducator(i) auto", driversHeader],
      ["Combustibil", vehicle.fuel_type],
    ].forEach((item, index) => {
      const x = 28 + index * cellW;
      box(x, topY, cellW, infoH);
      draw(item[0], x + 7, topY + 28, 6);
      draw(String(item[1]).slice(0, 34), x + 7, topY + 11, 7.3, true);
    });

    // Keep all existing columns and use the available right-side width for fueling.
    const cols = [24, 52, 82, 60, 60, 90, 48, 48, 66, 66, 60, 55, 65];
    const headers = ["Nr.", "Data", "Conducator", "Plecare", "Destinatie", "Scop", "Ora pl.", "Ora sos.", "Km plecare", "Km sosire", "Km parcurs", "Alim. L", "Alim. lei"];
    let y = topY - 40;
    let x = 28;
    const headerH = 25;
    headers.forEach((header, index) => {
      box(x, y, cols[index], headerH, rgb(.88, .91, .94));
      draw(header, x + 3, y + 9, 5.1, true);
      x += cols[index];
    });
    y -= headerH;

    const rowH = 22;
    pageTrips.forEach((trip: any, localIndex: number) => {
      x = 28;
      const globalIndex = pageIndex * rowsPerPage + localIndex + 1;
      const profile = profiles.get(trip.driver_id);
      const fuelOnTrip = tripFuel(fuel, trip.id);
      const data = [
        globalIndex,
        fmtDate(trip.start_at),
        driverDisplay(profile),
        trip.origin || "",
        trip.destination || "",
        trip.purpose || "",
        fmtTime(trip.start_at),
        trip.end_at ? fmtTime(trip.end_at) : "",
        fmtNumber(trip.start_odometer),
        fmtNumber(trip.end_odometer),
        fmtNumber(trip.distance_km),
        fuelOnTrip.count ? fmtNumber(fuelOnTrip.liters, 2) : "",
        fuelOnTrip.count ? fmtNumber(fuelOnTrip.amount, 2) : "",
      ];
      data.forEach((value, index) => {
        box(x, y, cols[index], rowH);
        const maxLen = index === 2 ? 20 : index === 5 ? 23 : 15;
        draw(String(value).slice(0, maxLen), x + 3, y + 8, index >= 11 ? 4.9 : 5.1, index === 10 || (index >= 11 && Boolean(value)));
        x += cols[index];
      });
      y -= rowH;
    });

    if (isLast) {
      const summaryY = 72;
      const summaryW = (W - 56) / 3;
      [
        ["Curse finalizate", String(trips.length)],
        ["Total kilometri", `${fmtNumber(totalKm)} km`],
        ["Total alimentare", `${fmtNumber(totalFuel, 2)} L / ${fmtNumber(totalFuelAmount, 2)} lei`],
      ].forEach((item, index) => {
        const sx = 28 + index * summaryW;
        box(sx, summaryY, summaryW, 38);
        draw(item[0], sx + 8, summaryY + 25, 6);
        draw(item[1], sx + 8, summaryY + 9, index === 2 ? 8.5 : 10, true);
      });

      draw("Conducator(i) auto", 28, 42, 6);
      draw(driverNames.join(" / ").slice(0, 65), 28, 24, 7.5, true);
      line(28, 12, 350, 12, .6);
      draw("Verificat / Aprobat", 470, 42, 6);
      draw(settings.approved_by || "", 470, 24, 8, true);
      line(470, 12, W - 28, 12, .6);
    }

    draw(`Pagina ${pageIndex + 1} din ${pageCount}`, W - 90, 12, 5.5, false, rgb(.45, .48, .5));
  }

  return await pdf.save();
}

function buildXlsx({ vehicle, trips, fuel, settings, profiles, year, month, number }: any) {
  const rows = trips.map((trip: any, index: number) => {
    const fuelOnTrip = tripFuel(fuel, trip.id);
    return {
      Nr: index + 1,
      Data: fmtDate(trip.start_at),
      "Conducator auto": driverDisplay(profiles.get(trip.driver_id)),
      Plecare: trip.origin || "",
      Destinatie: trip.destination || "",
      Scop: trip.purpose || "",
      "Ora plecare": fmtTime(trip.start_at),
      "Ora sosire": trip.end_at ? fmtTime(trip.end_at) : "",
      "Km plecare": Number(trip.start_odometer || 0),
      "Km sosire": Number(trip.end_odometer || 0),
      "Km parcurs": Number(trip.distance_km || 0),
      "Alimentare L": fuelOnTrip.count ? Number(fuelOnTrip.liters.toFixed(2)) : "",
      "Alimentare lei": fuelOnTrip.count ? Number(fuelOnTrip.amount.toFixed(2)) : "",
    };
  });

  const totalKm = trips.reduce((sum: number, trip: any) => sum + Number(trip.distance_km || 0), 0);
  const totalFuel = fuel.reduce((sum: number, entry: any) => sum + Number(entry.liters || 0), 0);
  const totalFuelAmount = fuel.reduce((sum: number, entry: any) => sum + Number(entry.total_amount || 0), 0);
  const driverNames = [...new Set(trips.map((trip: any) => driverDisplay(profiles.get(trip.driver_id))))];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.sheet_add_json(ws, rows, { origin: "A9" });
  XLSX.utils.sheet_add_aoa(ws, [
    [settings.company_header_name || "BCB Group", settings.company_legal_name || "BCB Construct Pro S.R.L.", "FOAIE DE PARCURS", number],
    ["Perioada", `${monthName(month)} ${year}`, "Vehicul", `${vehicle.make} ${vehicle.model}`],
    ["Nr. inmatriculare", vehicle.registration_number, "Combustibil", vehicle.fuel_type],
    ["Conducatori auto", driverNames.join(" / "), "Curse", trips.length],
    ["Km total", totalKm, "Alimentare total", `${Number(totalFuel.toFixed(2))} L / ${Number(totalFuelAmount.toFixed(2))} lei`],
    [], [], [],
  ], { origin: "A1" });
  ws["!cols"] = [
    { wch: 5 }, { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 20 }, { wch: 30 },
    { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Foaie parcurs");

  const tripMap = new Map(trips.map((trip: any) => [trip.id, trip]));
  const fuelSheet = XLSX.utils.json_to_sheet(fuel.map((entry: any) => {
    const linkedTrip: any = entry.trip_id ? tripMap.get(entry.trip_id) : null;
    return {
      Data: fmtDate(entry.fueled_at),
      "Conducator auto": driverDisplay(profiles.get(entry.driver_id)),
      Cursa: linkedTrip ? `${linkedTrip.origin || ""} → ${linkedTrip.destination || ""}` : "Neasociata unei curse",
      Litri: Number(entry.liters),
      Valoare: entry.total_amount != null ? Number(entry.total_amount) : "",
      "Pret / litru": entry.total_amount != null && Number(entry.liters) > 0 ? Number((Number(entry.total_amount) / Number(entry.liters)).toFixed(2)) : "",
      Kilometraj: entry.odometer != null ? Number(entry.odometer) : "",
      Statie: entry.station || "",
    };
  }));
  XLSX.utils.book_append_sheet(wb, fuelSheet, "Alimentari");

  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

async function sendEmail(apiKey: string, from: string, to: string, cc: string | undefined, subject: string, html: string, attachments: any[]) {
  const payload: any = {
    from,
    to: to.split(/[;,]/).map((value) => value.trim()).filter(Boolean),
    subject,
    html,
    attachments,
  };
  if (cc) payload.cc = cc.split(/[;,]/).map((value) => value.trim()).filter(Boolean);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Resend: ${await response.text()}`);
  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("FLEET_CRON_SECRET") || "";
    const auth = req.headers.get("Authorization") || "";
    const suppliedCron = req.headers.get("x-bcb-cron-secret") || "";
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

    let callerId: string | null = null;
    if (!(cronSecret && suppliedCron === cronSecret)) {
      const caller = createClient(url, anon, {
        global: { headers: { Authorization: auth } },
        auth: { persistSession: false },
      });
      const { data: userData } = await caller.auth.getUser();
      if (!userData.user) return json({ error: "Sesiune invalida" }, 401);
      callerId = userData.user.id;
      const { data: profile } = await admin
        .from("profiles")
        .select("role,is_active,is_owner")
        .eq("id", callerId)
        .single();
      if (!profile?.is_active || !(profile.is_owner || profile.role === "admin")) {
        return json({ error: "Doar Owner/Admin pot genera rapoarte." }, 403);
      }
    }

    const body = await req.json().catch(() => ({}));
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = Number(body.year || previousMonth.getFullYear());
    const month = Number(body.month || previousMonth.getMonth() + 1);
    if (month < 1 || month > 12) return json({ error: "Luna invalida" }, 400);

    const [start, end] = period(year, month);
    const [vehiclesResult, tripsResult, fuelResult, profilesResult, settingsResult] = await Promise.all([
      admin.from("fleet_vehicles").select("*").eq("is_active", true).order("registration_number"),
      admin.from("fleet_trips").select("*").gte("start_at", start).lt("start_at", end).eq("status", "completed").order("start_at"),
      admin.from("fleet_fuel_entries").select("*").gte("fueled_at", start).lt("fueled_at", end).order("fueled_at"),
      admin.from("profiles").select("id,full_name,email"),
      admin.from("fleet_settings").select("*").eq("id", true).single(),
    ]);

    if (vehiclesResult.error) throw vehiclesResult.error;
    if (tripsResult.error) throw tripsResult.error;
    if (fuelResult.error) throw fuelResult.error;
    if (profilesResult.error) throw profilesResult.error;
    if (settingsResult.error) throw settingsResult.error;

    const vehicles = vehiclesResult.data || [];
    const trips = tripsResult.data || [];
    const fuel = fuelResult.data || [];
    const settings = settingsResult.data;
    const profiles = new Map((profilesResult.data || []).map((profile: any) => [profile.id, profile]));

    let generated = 0;
    const emailAttachments: any[] = [];
    const generatedReports: any[] = [];

    for (const vehicle of vehicles) {
      const vehicleTrips = trips.filter((trip: any) => trip.vehicle_id === vehicle.id);
      if (!vehicleTrips.length) continue;

      const vehicleFuel = fuel.filter((entry: any) => entry.vehicle_id === vehicle.id);
      const number = reportNo(year, month, vehicle.registration_number);
      const pdfBytes = await buildPdf({ vehicle, trips: vehicleTrips, fuel: vehicleFuel, settings, profiles, year, month, number });
      const xlsxBytes = new Uint8Array(buildXlsx({ vehicle, trips: vehicleTrips, fuel: vehicleFuel, settings, profiles, year, month, number }));
      const base = `${year}/${String(month).padStart(2, "0")}/${vehicle.registration_number.replace(/\s+/g, "-")}`;
      const pdfPath = `${base}/${number}.pdf`;
      const xlsxPath = `${base}/${number}.xlsx`;

      const pdfUpload = await admin.storage.from("fleet-reports").upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (pdfUpload.error) throw pdfUpload.error;

      const xlsxUpload = await admin.storage.from("fleet-reports").upload(xlsxPath, xlsxBytes, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });
      if (xlsxUpload.error) throw xlsxUpload.error;

      const totalKm = vehicleTrips.reduce((sum: number, trip: any) => sum + Number(trip.distance_km || 0), 0);
      const totalFuel = vehicleFuel.reduce((sum: number, entry: any) => sum + Number(entry.liters || 0), 0);
      const totalFuelAmount = vehicleFuel.reduce((sum: number, entry: any) => sum + Number(entry.total_amount || 0), 0);

      const reportPayload = {
        vehicle_id: vehicle.id,
        report_year: year,
        report_month: month,
        report_number: number,
        driver_id: null,
        total_trips: vehicleTrips.length,
        total_km: totalKm,
        total_fuel_liters: totalFuel,
        pdf_path: pdfPath,
        xlsx_path: xlsxPath,
        generated_at: new Date().toISOString(),
        generated_by: callerId,
        status: "generated",
        error_message: null,
      };

      const { error: reportError } = await admin
        .from("fleet_reports")
        .upsert(reportPayload, { onConflict: "vehicle_id,report_year,report_month" });
      if (reportError) throw reportError;

      emailAttachments.push(
        { filename: `${number}.pdf`, content: bytesToBase64(pdfBytes) },
        { filename: `${number}.xlsx`, content: bytesToBase64(xlsxBytes) },
      );
      generatedReports.push({ vehicle: vehicle.registration_number, report_number: number, trips: vehicleTrips.length, total_km: totalKm, total_fuel_liters: totalFuel, total_fuel_amount: totalFuelAmount });
      generated++;
    }

    const shouldEmail = Boolean(body.send_email ?? settings.auto_email);
    let emailed = false;
    if (shouldEmail && settings.report_email && emailAttachments.length) {
      const apiKey = Deno.env.get("RESEND_API_KEY");
      const from = Deno.env.get("FLEET_EMAIL_FROM") || "BCB Group Fleet <fleet@bcbgroup.ro>";
      if (!apiKey) throw new Error("RESEND_API_KEY nu este configurat.");

      await sendEmail(
        apiKey,
        from,
        settings.report_email,
        settings.report_cc || undefined,
        `BCB Fleet · Foi de parcurs · ${monthName(month)} ${year}`,
        `<div style="font-family:Arial,sans-serif;color:#20252a"><h2>BCB Group · Fleet Management</h2><p>Atasat gasesti foile de parcurs pentru <strong>${monthName(month)} ${year}</strong>.</p><p>Fiecare vehicul are propriul PDF si fisier Excel, cu toate cursele lunii, conducatorul auto si alimentarile asociate fiecarei curse.</p><p>Documente generate automat de BCB Business Manager.</p></div>`,
        emailAttachments,
      );
      emailed = true;

      await admin
        .from("fleet_reports")
        .update({ status: "emailed", emailed_at: new Date().toISOString() })
        .eq("report_year", year)
        .eq("report_month", month);
    }

    return json({ success: true, generated, emailed, reports: generatedReports });
  } catch (error) {
    console.error("generate-fleet-reports failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
});