import { supabase } from "./supabase-client.js";

export const BCB_VAPID_PUBLIC_KEY = "BMPBotjiGHzbuPZTSEcuyrryp00xt9BLdQPzAn9dcEvYbRkNTVj-QmQnPOXYlhb69-TA26GypXdjLiJTi0IhWLU";

function base64UrlToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function getRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  let registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) {
    registration = await navigator.serviceWorker.register("../service-worker.js", { scope: "/" });
  }
  await navigator.serviceWorker.ready;
  return registration;
}

export async function ensureFleetPushSubscription({ requestPermission = false } = {}) {
  if (!("Notification" in window) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }

  let permission = Notification.permission;
  if (permission === "default" && requestPermission) {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return { ok: false, reason: permission === "denied" ? "denied" : "permission_required" };
  }

  const registration = await getRegistration();
  if (!registration) return { ok: false, reason: "service_worker_unavailable" };

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(BCB_VAPID_PUBLIC_KEY),
    });
  }

  const serialized = subscription.toJSON();
  const endpoint = serialized.endpoint || subscription.endpoint;
  const p256dh = serialized.keys?.p256dh;
  const auth = serialized.keys?.auth;
  if (!endpoint || !p256dh || !auth) return { ok: false, reason: "invalid_subscription" };

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return { ok: false, reason: "no_session" };

  const payload = {
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    user_agent: navigator.userAgent.slice(0, 500),
    device_label: `${navigator.platform || "device"} · ${navigator.userAgentData?.mobile ? "mobile" : "browser"}`.slice(0, 160),
    is_active: true,
  };

  const { error } = await supabase
    .from("web_push_subscriptions")
    .upsert(payload, { onConflict: "endpoint" });
  if (error) throw error;

  return { ok: true, subscription };
}

export async function notifyFleetTripPush(action, tripId) {
  if (!tripId) return { ok: false, reason: "missing_trip" };
  const { data, error } = await supabase.functions.invoke("fleet-trip-push", {
    body: { action, trip_id: tripId },
  });
  if (error) throw error;
  return data || { ok: true };
}
