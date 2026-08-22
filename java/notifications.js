const VAPID_PUBLIC_KEY = "BHx4kwVuek4CMfsuKhJswPXqOi6bBxlKd9ady7Yw9Ze05HucpoF-gI1ZzwWxbAXUXj0L4PPQd9EKM2ol7Bk6LF0";
const VAPID_VERSION = "push-vapid-20260821-final";
const SERVICE_WORKER_URL = "/sw.js?v=408-push-final";
const SUPABASE_URL = "https://knleehjjejfeobcmpwnw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E";

const PUSH_MARKER_KEY = "bariq_push_vapid_version";
const PUSH_ENABLED_KEY = "bariq_push_enabled";

function pushLog(event, data) {
  try { console.log("[BARIQ_PUSH]", event, data ?? ""); } catch (_) {}
}

function urlBase64ToUint8Array(value) {
  const padded = value + "=".repeat((4 - value.length % 4) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
}

function sameApplicationKey(subscription, publicKey) {
  try {
    const key = subscription?.options?.applicationServerKey;
    if (!key) return null;
    const actual = new Uint8Array(key);
    const expected = urlBase64ToUint8Array(publicKey);
    return actual.length === expected.length &&
      actual.every((value, index) => value === expected[index]);
  } catch (_) {
    return null;
  }
}

function normalizeUaePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00971")) digits = digits.slice(2);
  if (digits.startsWith("971")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  digits = digits.slice(0, 9);
  return digits ? "+971" + digits : "";
}

function getCurrentPushLanguage() {
  return (localStorage.getItem("lang") || document.documentElement.lang || "ar") === "en" ? "en" : "ar";
}

function getProfile() {
  try { return JSON.parse(localStorage.getItem("x2_profile") || "{}"); }
  catch (_) { return {}; }
}

function sendPushLanguageToServiceWorker() {
  try {
    const lang = getCurrentPushLanguage();
    navigator.serviceWorker?.ready.then(reg => {
      reg.active?.postMessage({ type: "SET_PUSH_LANG", lang });
    }).catch(() => {});
    navigator.serviceWorker?.controller?.postMessage({ type: "SET_PUSH_LANG", lang });
  } catch (_) {}
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, { updateViaCache: "none" });
    await registration.update().catch(() => {});
    sendPushLanguageToServiceWorker();
    return registration;
  } catch (err) {
    console.error("[BARIQ_PUSH] SW_REGISTER_FAILED", err);
    return null;
  }
}

window.addEventListener("storage", event => {
  if (event.key === "lang") sendPushLanguageToServiceWorker();
});
window.addEventListener("bariq:languagechange", sendPushLanguageToServiceWorker);

async function saveSubscriptionToSupabase(subscription) {
  try {
    const p256dh = subscription?.getKey?.("p256dh");
    const auth = subscription?.getKey?.("auth");
    if (!subscription?.endpoint || !p256dh || !auth) {
      throw new Error("Invalid browser PushSubscription");
    }

    const profile = getProfile();
    const payload = {
      endpoint: subscription.endpoint,
      p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
      auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
      user_phone: normalizeUaePhone(profile.phone || ""),
      user_email: String(profile.email || profile.authEmail || "").trim().toLowerCase(),
      user_lang: getCurrentPushLanguage(),
      vapid_public_key: VAPID_PUBLIC_KEY,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    pushLog("SAVE_ATTEMPT", {
      endpointHost: (() => { try { return new URL(subscription.endpoint).host; } catch (_) { return ""; } })(),
      phone: payload.user_phone,
      email: payload.user_email,
      vapidVersion: VAPID_VERSION
    });

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: "Bearer " + SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify(payload)
      }
    );

    const bodyText = await response.text().catch(() => "");
    pushLog("SAVE_RESPONSE", { status: response.status, ok: response.ok, body: bodyText.slice(0, 300) });

    if (!response.ok) {
      throw new Error(`Supabase subscription save failed (${response.status}): ${bodyText}`);
    }

    localStorage.setItem(PUSH_MARKER_KEY, VAPID_VERSION);
    localStorage.setItem(PUSH_ENABLED_KEY, "1");
    return true;
  } catch (err) {
    console.error("[BARIQ_PUSH] SAVE_FAILED", err);
    return false;
  }
}

async function createCurrentSubscription(registration, reason) {
  pushLog("SUBSCRIBE_START", { reason, permission: Notification.permission });
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });
  pushLog("SUBSCRIBE_CREATED", {
    endpointHost: (() => { try { return new URL(subscription.endpoint).host; } catch (_) { return ""; } })()
  });

  const saved = await saveSubscriptionToSupabase(subscription);
  if (!saved) {
    await subscription.unsubscribe().catch(() => {});
    throw new Error("New subscription was created but could not be saved");
  }
  return subscription;
}

async function ensureCurrentPushSubscription({ requestPermission = false, force = false } = {}) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return null;
  }

  if (requestPermission && Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return null;

  if (window.__bariqPushEnsurePromise) return window.__bariqPushEnsurePromise;

  window.__bariqPushEnsurePromise = (async () => {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    const markerMatches = localStorage.getItem(PUSH_MARKER_KEY) === VAPID_VERSION;
    const keyMatches = subscription ? sameApplicationKey(subscription, VAPID_PUBLIC_KEY) : null;

    pushLog("ENSURE_STATE", {
      hasSubscription: Boolean(subscription),
      markerMatches,
      keyMatches,
      permission: Notification.permission
    });

    // Critical migration rule:
    // If the VAPID version marker is missing/different, force one clean re-subscription.
    // This also repairs iOS/PWA reinstalls where browser permission remains granted
    // but localStorage was wiped.
    const mustMigrate = force || !markerMatches || keyMatches === false;

    if (mustMigrate && subscription) {
      pushLog("STALE_SUBSCRIPTION_UNSUBSCRIBE", { reason: !markerMatches ? "version-marker" : "application-key" });
      await subscription.unsubscribe().catch(err => console.warn("[BARIQ_PUSH] UNSUBSCRIBE_OLD_FAILED", err));
      subscription = null;
    }

    if (!subscription) {
      return await createCurrentSubscription(registration, mustMigrate ? "vapid-migration" : "missing-subscription");
    }

    // Existing subscription is trusted only after it is successfully persisted
    // with the active VAPID public key.
    const saved = await saveSubscriptionToSupabase(subscription);
    if (!saved) return null;

    return subscription;
  })();

  try {
    return await window.__bariqPushEnsurePromise;
  } finally {
    window.__bariqPushEnsurePromise = null;
  }
}

async function subscribeToPush() {
  try {
    return await ensureCurrentPushSubscription({ requestPermission: true, force: false });
  } catch (err) {
    console.error("[BARIQ_PUSH] SUBSCRIBE_FAILED", err);
    return null;
  }
}

async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
    localStorage.removeItem(PUSH_MARKER_KEY);
    localStorage.setItem(PUSH_ENABLED_KEY, "0");
    clearBadge();
  } catch (err) {
    console.warn("[BARIQ_PUSH] UNSUBSCRIBE_FAILED", err);
  }
}

async function getPushStatus() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "unsubscribed";

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return "unsubscribed";
    if (localStorage.getItem(PUSH_MARKER_KEY) !== VAPID_VERSION) return "stale";
    const keyMatches = sameApplicationKey(subscription, VAPID_PUBLIC_KEY);
    if (keyMatches === false) return "stale";
    return "subscribed";
  } catch (_) {
    return "unsubscribed";
  }
}

function updateBadge(count) {
  if ("setAppBadge" in navigator) {
    (count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge()).catch(() => {});
  }
  const badge = document.getElementById("mobNotifBadge");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.style.display = "";
  } else {
    badge.style.display = "none";
  }
}

function clearBadge() {
  updateBadge(0);
  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_BADGE" });
}

async function initPushButton() {
  const buttons = document.querySelectorAll("#push-subscribe-btn");
  if (!buttons.length) return;

  const enabledText = "🔔 الإشعارات مفعلة";
  const enableText = "🔔 تفعيل الإشعارات";

  function render(enabled, text) {
    buttons.forEach(button => {
      button.disabled = false;
      button.style.display = "inline-flex";
      button.style.opacity = "";
      button.textContent = text || (enabled ? enabledText : enableText);
      button.style.background = enabled ? "#27ae60" : "";
      button.style.color = enabled ? "#fff" : "";
    });
  }

  // Auto-repair silently for users who already granted permission.
  if (Notification.permission === "granted") {
    await ensureCurrentPushSubscription().catch(err => console.warn("[BARIQ_PUSH] AUTO_REPAIR_FAILED", err));
  }

  const status = await getPushStatus();
  if (status === "unsupported") {
    render(false, "🔔 الإشعارات غير مدعومة");
    buttons.forEach(button => button.disabled = true);
    return;
  }
  render(status === "subscribed");

  buttons.forEach(button => {
    button.onclick = async () => {
      const currentStatus = await getPushStatus();
      if (currentStatus === "subscribed") {
        await unsubscribeFromPush();
        render(false);
        return;
      }

      buttons.forEach(btn => { btn.disabled = true; btn.textContent = "⏳..."; });
      const subscription = await subscribeToPush();
      render(Boolean(subscription));
    };
  });
}

(async () => {
  await registerSW();

  // This is intentionally automatic. If notification permission is still granted,
  // the device repairs/migrates its PushSubscription on the next app/site open.
  if ("Notification" in window && Notification.permission === "granted") {
    await ensureCurrentPushSubscription().catch(err => console.warn("[BARIQ_PUSH] STARTUP_REPAIR_FAILED", err));
  }

  await initPushButton();
  clearBadge();

  try {
    const unread = JSON.parse(localStorage.getItem("x2_notifications") || "[]").filter(item => !item.read).length;
    if (unread > 0) updateBadge(unread);
  } catch (_) {}
})();
