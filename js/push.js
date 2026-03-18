(() => {
  const btn = document.querySelector("[data-enable-push]");
  const testBtn = document.querySelector("[data-test-push]");
  const statusEl = document.querySelector("[data-push-status]");

  const setStatus = (text, isError) => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = isError ? "#c13a2e" : "";
  };

  const subscribePush = async () => {
    if (!("Notification" in window)) {
      throw new Error("Notifications are not supported in this browser.");
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Notification permission denied.");
    }
    if (window.PushRelay && typeof window.PushRelay.push === "function") {
      window.PushRelay.push(["subscribe"]);
      return true;
    }
    if (window.pushrelay && typeof window.pushrelay.push === "function") {
      window.pushrelay.push(["subscribe"]);
      return true;
    }
    setStatus("Allow notifications in the browser prompt, then use the PushRelay bell to subscribe.", false);
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

  const syncButtonState = async () => {
    if (!btn) return;
    if (!("Notification" in window)) return;
  };

  if (btn) {
    btn.addEventListener("click", async () => {
      setStatus("Enabling notifications...");
      try {
        await subscribePush();
        setStatus("Notifications enabled for this device.", false);
        btn.textContent = "Notifications Enabled";
        if (testBtn) testBtn.disabled = false;
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncButtonState);
  } else {
    syncButtonState();
  }
})();
