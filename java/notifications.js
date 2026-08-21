const VAPID_PUBLIC_KEY = "BMr4ZWTwS2DgL12mxYFjLM9rmnljnJpY_tsFtWtKxgS2d_z36lcg3sLfIQfOFbX1Tw0ITNG3pB4hJeGI-YEZFHE";
const SERVICE_WORKER_URL = "/sw.js?v=335";

function urlBase64ToUint8Array(e) {
    const r = (e + "=".repeat((4 - e.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/"), t = window.atob(r);
    return Uint8Array.from([...t].map(e => e.charCodeAt(0)));
}

function samePushApplicationKey(subscription, publicKey) {
    try {
        const currentKey = subscription && subscription.options && subscription.options.applicationServerKey;
        if (!currentKey) return false;
        const currentBytes = new Uint8Array(currentKey);
        const expectedBytes = urlBase64ToUint8Array(publicKey);
        return currentBytes.length === expectedBytes.length && currentBytes.every((value, index) => value === expectedBytes[index]);
    } catch (err) {
        console.warn("Failed to compare VAPID application key:", err);
        return false;
    }
}

function normalizeUaePhone(e) {
    let r = String(e || "").replace(/\D/g, "");
    if (r.startsWith("00971")) r = r.slice(2);
    if (r.startsWith("971")) r = r.slice(3);
    if (r.startsWith("0")) r = r.slice(1);
    r = r.slice(0, 9);
    return r ? "+971" + r : "";
}

function getCurrentPushLanguage() {
    return (localStorage.getItem("lang") || document.documentElement.lang || "ar") === "en" ? "en" : "ar";
}

function sendPushLanguageToServiceWorker() {
    try {
        const lang = getCurrentPushLanguage();
        if (navigator.serviceWorker) {
            navigator.serviceWorker.ready.then(registration => {
                if (registration.active) {
                    registration.active.postMessage({ type: "SET_PUSH_LANG", lang });
                }
            }).catch(() => {});
        }
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: "SET_PUSH_LANG", lang });
        }
    } catch (err) {
        console.warn("Failed to send push language to service worker:", err);
    }
}

async function registerSW() {
    if (!("serviceWorker" in navigator)) return null;
    try {
        const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, { updateViaCache: "none" });
        registration.update().catch(() => {});
        sendPushLanguageToServiceWorker();
        refreshCurrentPushSubscriptionLanguage().catch(() => {});
        return registration;
    } catch (err) {
        console.warn("Service worker registration failed:", err);
        return null;
    }
}

window.addEventListener("storage", e => {
    if (e.key === "lang") sendPushLanguageToServiceWorker();
});

window.addEventListener("bariq:languagechange", sendPushLanguageToServiceWorker);

async function refreshCurrentPushSubscriptionLanguage() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;
        if (!samePushApplicationKey(subscription, VAPID_PUBLIC_KEY)) {
            console.warn("Existing push subscription uses an old VAPID key.");
            return;
        }
        await saveSubscriptionToSupabase(subscription);
    } catch (err) {
        console.warn("Failed to refresh push subscription language:", err);
    }
}

async function getPushStatus() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return "unsubscribed";
        if (!samePushApplicationKey(subscription, VAPID_PUBLIC_KEY)) return "stale";
        return "subscribed";
    } catch (err) {
        console.warn("Failed to check push status:", err);
        return "unsubscribed";
    }
}

async function subscribeToPush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
    try {
        const registration = await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            console.warn("Notification permission:", permission);
            return null;
        }

        let subscription = await registration.pushManager.getSubscription();

        if (subscription && !samePushApplicationKey(subscription, VAPID_PUBLIC_KEY)) {
            console.log("Old VAPID subscription detected. Re-subscribing...");
            try {
                await subscription.unsubscribe();
            } catch (err) {
                console.warn("Could not unsubscribe old push subscription:", err);
            }
            subscription = null;
        }

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
            console.log("New push subscription created.");
        }

        const saved = await saveSubscriptionToSupabase(subscription);
        if (!saved) {
            console.error("Push subscription exists on device but could not be saved to Supabase.");
            return null;
        }

        console.log("Push subscription saved successfully.");
        updateBadge(0);
        sendPushLanguageToServiceWorker();
        return subscription;
    } catch (err) {
        console.error("Push subscription failed:", err);
        return null;
    }
}

async function saveSubscriptionToSupabase(subscription) {
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E";

    try {
        let profile = {};
        try {
            profile = JSON.parse(localStorage.getItem("x2_profile") || "{}");
        } catch (_) {
            profile = {};
        }

        const p256dh = subscription.getKey("p256dh");
        const auth = subscription.getKey("auth");

        if (!subscription.endpoint || !p256dh || !auth) {
            console.error("Invalid push subscription:", subscription);
            return false;
        }

        const payload = {
            endpoint: subscription.endpoint,
            p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
            auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
            user_phone: normalizeUaePhone(profile.phone || ""),
            user_email: String(profile.email || profile.authEmail || "").trim().toLowerCase(),
            user_lang: getCurrentPushLanguage(),
            created_at: new Date().toISOString()
        };

        const response = await fetch("https://knleehjjejfeobcmpwnw.supabase.co/rest/v1/push_subscriptions", {
            method: "POST",
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: "Bearer " + SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates,return=minimal"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Failed to save push subscription:", response.status, errorText);
            return false;
        }

        console.log("Subscription stored in Supabase:", subscription.endpoint);
        return true;
    } catch (err) {
        console.error("Failed to save subscription:", err);
        return false;
    }
}

async function unsubscribeFromPush() {
    if (!("serviceWorker" in navigator)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) await subscription.unsubscribe();
        clearBadge();
    } catch (err) {
        console.warn("Failed to unsubscribe from push:", err);
    }
}

function updateBadge(e) {
    "setAppBadge" in navigator && (e > 0 ? navigator.setAppBadge(e).catch(() => {}) : navigator.clearAppBadge().catch(() => {}));
    const badge = document.getElementById("mobNotifBadge");
    if (!badge) return;
    if (e > 0) {
        badge.textContent = e > 99 ? "99+" : e;
        badge.style.display = "";
    } else {
        badge.style.display = "none";
    }
}

function clearBadge() {
    updateBadge(0);
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "CLEAR_BADGE" });
    }
}

async function initPushButton() {
    const buttons = document.querySelectorAll("#push-subscribe-btn");
    if (!buttons.length) return;

    const enabledText = "&#128276; &#1605;&#1601;&#1593;&#1604; &#10003;";
    const enableText = "&#128277; &#1578;&#1601;&#1593;&#1610;&#1604; &#1575;&#1604;&#1573;&#1588;&#1593;&#1575;&#1585;&#1575;&#1578;";

    function renderButton(enabled, text) {
        buttons.forEach(button => {
            button.disabled = false;
            button.style.display = "inline-flex";
            button.style.opacity = "";
            button.innerHTML = text || (enabled ? enabledText : enableText);
            button.style.background = enabled ? "#27ae60" : "";
            button.style.color = enabled ? "#fff" : "";
        });
    }

    const status = await getPushStatus();

    if (status === "unsupported") {
        const text = "&#128276; &#1575;&#1604;&#1573;&#1588;&#1593;&#1575;&#1585;&#1575;&#1578; &#1594;&#1610;&#1585; &#1605;&#1583;&#1593;&#1608;&#1605;&#1577; &#1593;&#1604;&#1609; &#1607;&#1584;&#1575; &#1575;&#1604;&#1605;&#1578;&#1589;&#1601;&#1581;";
        buttons.forEach(button => {
            button.disabled = true;
            button.style.display = "inline-flex";
            button.style.opacity = ".75";
            button.innerHTML = text;
        });
        return;
    }

    if (status === "subscribed") {
        renderButton(true, "&#128276; &#1575;&#1604;&#1573;&#1588;&#1593;&#1575;&#1585;&#1575;&#1578; &#1605;&#1601;&#1593;&#1604;&#1577;");
    } else {
        renderButton(false, enableText);
    }

    buttons.forEach(button => {
        button.onclick = async () => {
            const currentStatus = await getPushStatus();

            if (currentStatus === "subscribed") {
                await unsubscribeFromPush().catch(console.warn);
                renderButton(false, enableText);
                return;
            }

            buttons.forEach(btn => {
                btn.disabled = true;
                btn.innerHTML = "&#9203;...";
            });

            const subscription = await subscribeToPush();

            if (subscription) {
                renderButton(true, enabledText);
            } else {
                renderButton(false, enableText);
            }
        };
    });
}

(async () => {
    await registerSW();
    await initPushButton();
    clearBadge();

    try {
        const unread = JSON.parse(localStorage.getItem("x2_notifications") || "[]").filter(item => !item.read).length;
        if (unread > 0) updateBadge(unread);
        else clearBadge();
    } catch (err) {
        clearBadge();
    }
})();
