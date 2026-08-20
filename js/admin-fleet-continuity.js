import { supabase, esc } from "./admin-common.js";
import { ensureFleetPushSubscription, notifyFleetTripPush } from "./admin-web-push.js";

const modal = document.querySelector("#fleet-modal");
const modalContent = document.querySelector("#fleet-modal-content");

function showModal(html) {
  if (!modal || !modalContent) return;
  modalContent.innerHTML = html;
  modal.hidden = false;
}

function hideModal() {
  if (!modal || !modalContent) return;
  modal.hidden = true;
  modalContent.innerHTML = "";
}

function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

function formatKm(value) {
  return `${Number(value || 0).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} km`;
}

async function getContext() {
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session || null;
}

async function getActiveTrip(userId) {
  const { data } = await supabase
    .from("fleet_trips")
    .select("*")
    .eq("driver_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data || null;
}

async function openStartFlow() {
  const session = await getContext();
  if (!session) return;

  const existing = await getActiveTrip(session.user.id);
  if (existing) {
    alert("Ai deja o cursă activă. Încheie cursa curentă înainte să pornești alta.");
    return;
  }

  const [{ data: vehicles, error: vehicleError }, { data: projects }] = await Promise.all([
    supabase.from("fleet_vehicles").select("id,registration_number,make,model,current_odometer").eq("is_active", true).order("registration_number"),
    supabase.from("projects").select("id,title").order("title"),
  ]);

  if (vehicleError || !vehicles?.length) {
    alert(vehicleError?.message || "Nu există vehicule active.");
    return;
  }

  showModal(`
    <h2>Start cursă</h2>
    <p style="color:#777;font-size:10px;margin-top:5px">Kilometrajul de plecare este preluat automat din fișa mașinii.</p>
    <form id="fleet-smart-start-form" class="fleet-form">
      <label>Vehicul
        <select name="vehicle_id" required>
          ${vehicles.map((vehicle) => `<option value="${vehicle.id}">${esc(vehicle.registration_number)} · ${esc(vehicle.make)} ${esc(vehicle.model)}</option>`).join("")}
        </select>
      </label>
      <label>Kilometraj plecare
        <div id="fleet-auto-start-odometer" style="min-height:46px;display:flex;align-items:center;padding:0 14px;border:1px solid rgba(29,34,39,.10);border-radius:12px;background:#f2eee5;font-weight:950;color:#1d2227"></div>
      </label>
      <label>Plecare<input name="origin" required placeholder="Sediu / Oradea / șantier..."></label>
      <label>Destinație<input name="destination" placeholder="Destinația planificată"></label>
      <label class="wide">Scop deplasare<input name="purpose" required placeholder="Deplasare la șantier / materiale / client..."></label>
      <label class="wide">Proiect
        <select name="project_id"><option value="">Fără proiect asociat</option>${(projects || []).map((project) => `<option value="${project.id}">${esc(project.title)}</option>`).join("")}</select>
      </label>
      <div class="fleet-gps-note"><i class="fa-solid fa-location-dot"></i> Ora, utilizatorul și kilometrajul sunt automate. La START activăm și notificarea persistentă a cursei dacă permiți notificările pe dispozitiv.</div>
      <button type="submit"><i class="fa-solid fa-play"></i> PORNEȘTE CURSA</button>
    </form>
  `);

  const select = modalContent.querySelector('[name="vehicle_id"]');
  const display = modalContent.querySelector("#fleet-auto-start-odometer");
  const syncDisplay = () => {
    const vehicle = vehicles.find((item) => item.id === select.value);
    display.textContent = formatKm(vehicle?.current_odometer);
  };
  syncDisplay();
  select.addEventListener("change", syncDisplay);

  modalContent.querySelector("#fleet-smart-start-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement=event.currentTarget;
    const submitButton=formElement.querySelector('button[type="submit"]');
    if(submitButton){submitButton.disabled=true;submitButton.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> PORNIRE…';}
    try {
      const pushState = await ensureFleetPushSubscription({ requestPermission: true }).catch((error) => {
        console.warn("BCB Fleet push subscription:", error);
        return { ok:false, reason:"error" };
      });
      const form = new FormData(formElement);
      const vehicle = vehicles.find((item) => item.id === form.get("vehicle_id"));
      if (!vehicle) return;
      const position = await getPosition();

      const { data: trip, error } = await supabase.from("fleet_trips").insert({
        vehicle_id: vehicle.id,
        driver_id: session.user.id,
        project_id: form.get("project_id") || null,
        start_odometer: Number(vehicle.current_odometer || 0),
        origin: String(form.get("origin") || "").trim(),
        destination: String(form.get("destination") || "").trim() || null,
        purpose: String(form.get("purpose") || "").trim(),
        start_lat: position?.lat || null,
        start_lng: position?.lng || null,
        status: "active",
      }).select("id").single();

      if (error) { alert(error.message); return; }
      if(pushState?.ok&&trip?.id)notifyFleetTripPush("start",trip.id).catch(error=>console.warn("BCB Fleet start push:",error));
      hideModal();
      window.location.reload();
    } finally {
      if(submitButton){submitButton.disabled=false;submitButton.innerHTML='<i class="fa-solid fa-play"></i> PORNEȘTE CURSA';}
    }
  });
}

async function openStopFlow() {
  const session = await getContext();
  if (!session) return;
  const trip = await getActiveTrip(session.user.id);
  if (!trip) { alert("Nu există nicio cursă activă."); return; }

  const { data: vehicle } = await supabase.from("fleet_vehicles").select("registration_number,make,model,current_odometer").eq("id", trip.vehicle_id).single();

  showModal(`
    <h2>Încheie cursa</h2>
    <p style="color:#777;font-size:10px;margin-top:5px">${esc(vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.registration_number}` : "Vehicul")} · Plecare ${formatKm(trip.start_odometer)}</p>
    <form id="fleet-smart-stop-form" class="fleet-form">
      <label>Kilometraj sosire<input name="end_odometer" type="number" step="0.1" min="${Number(trip.start_odometer)}" required autofocus inputmode="decimal" placeholder="Km afișați în bord"></label>
      <label>Destinație finală<input name="destination" value="${esc(trip.destination || "")}"></label>
      <label class="wide">Observații<textarea name="notes" placeholder="Opțional"></textarea></label>
      <div class="fleet-gps-note"><i class="fa-solid fa-gauge-high"></i> La salvare, km sosire devin kilometrajul curent al mașinii. Notificarea persistentă a cursei este închisă automat.</div>
      <button type="submit"><i class="fa-solid fa-stop"></i> ÎNCHEIE CURSA</button>
    </form>
  `);

  modalContent.querySelector("#fleet-smart-stop-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement=event.currentTarget;
    const submitButton=formElement.querySelector('button[type="submit"]');
    const form = new FormData(formElement);
    const endOdometer = Number(form.get("end_odometer"));
    const startOdometer = Number(trip.start_odometer);
    if (!Number.isFinite(endOdometer) || endOdometer < startOdometer) { alert("Kilometrajul final trebuie să fie mai mare sau egal cu cel de plecare."); return; }
    if (endOdometer - startOdometer > 3000 && !confirm(`Ai introdus o diferență de ${formatKm(endOdometer - startOdometer)}. Verifică numărul din bord. Continui?`)) return;
    if(submitButton){submitButton.disabled=true;submitButton.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> ÎNCHIDERE…';}
    try {
      const position = await getPosition();
      const { error } = await supabase.from("fleet_trips").update({
        end_odometer: endOdometer,
        end_at: new Date().toISOString(),
        destination: String(form.get("destination") || "").trim() || trip.destination,
        notes: String(form.get("notes") || "").trim() || null,
        end_lat: position?.lat || null,
        end_lng: position?.lng || null,
        status: "completed",
      }).eq("id", trip.id);
      if (error) { alert(error.message); return; }
      await ensureFleetPushSubscription({requestPermission:false}).catch(()=>null);
      notifyFleetTripPush("stop",trip.id).catch(error=>console.warn("BCB Fleet stop push:",error));
      hideModal();
      window.location.reload();
    } finally {
      if(submitButton){submitButton.disabled=false;submitButton.innerHTML='<i class="fa-solid fa-stop"></i> ÎNCHEIE CURSA';}
    }
  });
}

// Capture phase runs before the legacy target listeners in admin-fleet.js.
document.addEventListener("click", (event) => {
  const startButton = event.target.closest("#fleet-start-main");
  if (startButton) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); openStartFlow(); return; }
  const stopButton = event.target.closest("#fleet-stop-active");
  if (stopButton) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); openStopFlow(); }
}, true);
