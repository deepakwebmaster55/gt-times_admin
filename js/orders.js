const ordersStatus = document.querySelector("[data-orders-status]");
const ordersBody = document.querySelector("[data-orders-body]");

const setOrdersStatus = (message, isError) => {
  if (!ordersStatus) return;
  ordersStatus.textContent = message;
  ordersStatus.style.color = isError ? "#c13a2e" : "";
};

const formatDate = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString();
  } catch (error) {
    return "";
  }
};

const formatAddress = (address) => {
  if (!address) return "";
  const parts = [address.line1, address.line2, address.city, address.state, address.postal_code, address.country]
    .filter(Boolean);
  return `${address.label ? address.label + ": " : ""}${parts.join(", ")}`;
};

const statusClass = (status) => {
  const value = String(status || "").toLowerCase();
  if (value.includes("paid") || value.includes("success")) return "status-badge success";
  if (value.includes("pending") || value.includes("cod")) return "status-badge pending";
  if (value.includes("failed") || value.includes("cancel")) return "status-badge danger";
  return "status-badge";
};

const renderOrders = (rows, profilesMap, addressMap, itemsMap, paymentsMap) => {
  if (!ordersBody) return;
  ordersBody.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9" class="small">No bookings yet.</td>`;
    ordersBody.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const profile = profilesMap.get(row.user_id) || {};
    const address = row.address_snapshot || addressMap.get(row.user_id) || {};
    const items = itemsMap.get(row.id) || [];
    const payment = paymentsMap.get(row.id) || {};
    const itemsText = items.length
      ? items.map((item) => `${item.title || "Item"} x${item.quantity || 1}`).join("; ")
      : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.order_number || row.id.slice(0, 8)}</td>
      <td>${formatDate(row.created_at)}</td>
      <td>${profile.full_name || ""}</td>
      <td>${profile.phone || ""}<br />${profile.email || ""}</td>
      <td>${formatAddress(address) || "-"}</td>
      <td>${itemsText}</td>
      <td>Rs. ${Number(row.total_amount || 0).toLocaleString()}</td>
      <td><span class="${statusClass(row.status)}">${row.status || "pending"}</span></td>
      <td><span class="${statusClass(payment.status)}">${payment.status || "unpaid"}</span></td>
    `;
    ordersBody.appendChild(tr);
  });
};

const loadOrders = async () => {
  if (!window.callSupabase3AdminFunction) {
    setOrdersStatus("Supabase 3 functions not configured.", true);
    return;
  }

  setOrdersStatus("Loading bookings...");

  const token = await window.getAdminAccessToken?.();
  if (!token) {
    setOrdersStatus("Admin session expired. Please login again.", true);
    return;
  }

  try {
    const response = await window.callSupabase3AdminFunction("admin-bookings", {}, token);
    if (response?.error) {
      setOrdersStatus(response.error, true);
      return;
    }

    const bookings = response.bookings || [];
    const profiles = response.profiles || [];
    const addresses = response.addresses || [];
    const items = response.items || [];
    const payments = response.payments || [];

    const lastSeen = localStorage.getItem("gt_admin_last_booking") || "";
    const latestId = bookings[0]?.id || "";
    if (latestId && latestId !== lastSeen) {
      localStorage.setItem("gt_admin_last_booking", latestId);
      if (typeof window.showToast === "function") {
        window.showToast("New booking received.");
      }
    }

    const profilesMap = new Map();
    profiles.forEach((profile) => profilesMap.set(profile.id, profile));

    const addressMap = new Map();
    addresses.forEach((address) => {
      if (!addressMap.has(address.user_id)) {
        addressMap.set(address.user_id, address);
      }
    });

    const itemsMap = new Map();
    items.forEach((item) => {
      const list = itemsMap.get(item.booking_id) || [];
      list.push(item);
      itemsMap.set(item.booking_id, list);
    });

    const paymentsMap = new Map();
    payments.forEach((payment) => {
      paymentsMap.set(payment.booking_id, payment);
    });

    renderOrders(bookings, profilesMap, addressMap, itemsMap, paymentsMap);
    setOrdersStatus("");
  } catch (error) {
    setOrdersStatus(error.message || "Failed to load bookings.", true);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  window.requireAdminAuth?.(loadOrders);
  setInterval(loadOrders, 15000);
});
