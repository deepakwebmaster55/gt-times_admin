(() => {
  const btn = document.querySelector("[data-enable-push]");
  const testBtn = document.querySelector("[data-test-push]");
  const statusEl = document.querySelector("[data-push-status]");

  const setStatus = (text, isError) => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = isError ? "#c13a2e" : "";
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const getVapidKey = () => window.GT_ADMIN_CONFIG?.supabase3?.vapidPublicKey || "";

  const ensureServiceWorker = async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service workers not supported.");
    const registration = await navigator.serviceWorker.register("sw.js", { scope: "./" });
    return registration;
  };

  const subscribePush = async () => {
    if (!("Notification" in window)) {
      throw new Error("Notifications are not supported in this browser.");
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Notification permission denied.");
    }

    const vapidKey = getVapidKey();
    if (!vapidKey) {
      throw new Error("VAPID public key missing in admin/js/config.js");
    }

    const registration = await ensureServiceWorker();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
    }

    const token = await window.getAdminAccessToken?.();
    if (!token) {
      throw new Error("Please login to admin first.");
    }

    const payload = {
      action: "subscribe",
      subscription
    };

    const response = await window.callSupabase3AdminFunction?.("admin-push", payload, token);
    if (response?.error) {
      throw new Error(response.error);
    }

    return true;
  };

  const sendTest = async () => {
    const token = await window.getAdminAccessToken?.();
    if (!token) {
      throw new Error("Please login to admin first.");
    }
    const response = await window.callSupabase3AdminFunction?.("admin-push", { action: "test" }, token);
    if (response?.error) {
      throw new Error(response.error);
    }
    return true;
  };

  if (btn) {
    btn.addEventListener("click", async () => {
      setStatus("Enabling notifications...");
      try {
        await subscribePush();
        setStatus("Notifications enabled for this device.", false);
        btn.disabled = true;
        btn.textContent = "Notifications Enabled";
        if (testBtn) {
          testBtn.disabled = false;
        }
      } catch (error) {
        setStatus(error.message || "Unable to enable notifications.", true);
      }
    });
  }

  if (testBtn) {
    testBtn.disabled = false;
    testBtn.addEventListener("click", async () => {
      setStatus("Sending test notification...");
      try {
        await sendTest();
        setStatus("Test notification sent.", false);
      } catch (error) {
        setStatus(error.message || "Unable to send test notification.", true);
      }
    });
  }
})();
