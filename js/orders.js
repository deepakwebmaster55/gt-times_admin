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
  if (!window.gtSupabase3) {
    setOrdersStatus("Supabase 3 keys missing in admin/js/config.js", true);
    return;
  }

  const { data: sessionData } = await window.gtSupabase3.auth.getSession();
  if (!sessionData?.session) {
    setOrdersStatus("Login to Supabase 3 to view bookings.", true);
    return;
  }

  setOrdersStatus("Loading bookings...");

  const { data: bookings, error } = await window.gtSupabase3
    .from("bookings")
    .select("id, order_number, total_amount, status, created_at, user_id, address_id, address_snapshot")
    .order("created_at", { ascending: false });

  if (error) {
    setOrdersStatus(error.message, true);
    return;
  }

  const bookingIds = (bookings || []).map((row) => row.id);
  const userIds = Array.from(new Set((bookings || []).map((row) => row.user_id).filter(Boolean)));

  const [profilesRes, addressesRes, itemsRes, paymentsRes] = await Promise.all([
    userIds.length
      ? window.gtSupabase3.from("profiles").select("id, full_name, phone, email").in("id", userIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? window.gtSupabase3.from("addresses").select("*").in("user_id", userIds).order("is_default", { ascending: false })
      : Promise.resolve({ data: [] }),
    bookingIds.length
      ? window.gtSupabase3.from("booking_items").select("booking_id, title, quantity, price").in("booking_id", bookingIds)
      : Promise.resolve({ data: [] }),
    bookingIds.length
      ? window.gtSupabase3.from("payments").select("booking_id, status, transaction_id").in("booking_id", bookingIds)
      : Promise.resolve({ data: [] })
  ]);

  const profilesMap = new Map();
  (profilesRes.data || []).forEach((profile) => profilesMap.set(profile.id, profile));

  const addressMap = new Map();
  (addressesRes.data || []).forEach((address) => {
    if (!addressMap.has(address.user_id)) {
      addressMap.set(address.user_id, address);
    }
  });

  const itemsMap = new Map();
  (itemsRes.data || []).forEach((item) => {
    const list = itemsMap.get(item.booking_id) || [];
    list.push(item);
    itemsMap.set(item.booking_id, list);
  });

  const paymentsMap = new Map();
  (paymentsRes.data || []).forEach((payment) => {
    paymentsMap.set(payment.booking_id, payment);
  });

  renderOrders(bookings || [], profilesMap, addressMap, itemsMap, paymentsMap);
  setOrdersStatus("");
};

document.addEventListener("DOMContentLoaded", () => {
  window.requireAdminAuth?.(loadOrders);
});
