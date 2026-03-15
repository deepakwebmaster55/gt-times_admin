const statusEl = document.querySelector("[data-admin-access-status]");
const form = document.querySelector("[data-admin-create-form]");

const setStatus = (message, isError) => {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#c13a2e" : "";
};

const handleCreate = async (event) => {
  event.preventDefault();
  if (!window.gtSupabase1) {
    setStatus("Supabase 1 keys missing.", true);
    return;
  }
  if (!window.callSupabase3AdminFunction) {
    setStatus("Supabase 3 functions not configured.", true);
    return;
  }

  const fullName = form.querySelector("#admin-name").value.trim();
  const email = form.querySelector("#admin-email").value.trim();
  const phone = form.querySelector("#admin-phone").value.trim();
  const password = form.querySelector("#admin-password").value.trim();

  if (!fullName || !email || !password) {
    setStatus("Please fill name, email, and password.", true);
    return;
  }

  setStatus("Creating admin access...");

  const token = await window.getAdminAccessToken?.();
  if (!token) {
    setStatus("Admin session expired. Please login again.", true);
    return;
  }

  try {
    const result = await window.callSupabase3AdminFunction("admin-users", {
      full_name: fullName,
      email,
      phone,
      password
    }, token);

    if (result?.error) {
      setStatus(result.error, true);
      return;
    }

    setStatus("Admin access created in Supabase 3.");
    if (typeof window.showToast === "function") {
      window.showToast("Admin saved successfully.");
    }
    form.reset();
  } catch (error) {
    setStatus(error.message || "Failed to create admin.", true);
    if (typeof window.showToast === "function") {
      window.showToast("Failed to save admin.");
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  window.requireAdminAuth?.();
  if (form) form.addEventListener("submit", handleCreate);
});
