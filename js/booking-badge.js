const badgeEl = document.querySelector("[data-bookings-badge]");

const setBadge = (count) => {
  if (!badgeEl) return;
  const value = Number(count || 0);
  badgeEl.textContent = String(value);
  badgeEl.style.display = value > 0 ? "inline-flex" : "none";
};

const loadBookingCount = async () => {
  if (!window.callSupabase3AdminFunction) return;
  const token = await window.getAdminAccessToken?.();
  if (!token) return;
  try {
    const response = await window.callSupabase3AdminFunction("admin-bookings", {}, token);
    if (response?.bookings) {
      setBadge(response.bookings.length);
    }
  } catch (error) {
    setBadge(0);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  window.requireAdminAuth?.(loadBookingCount);
});
