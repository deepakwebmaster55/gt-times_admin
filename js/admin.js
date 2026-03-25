const createAdminLoader = () => {
  let loader = document.querySelector(".admin-loader");
  if (!loader) {
    loader = document.createElement("div");
    loader.className = "admin-loader";
    loader.innerHTML = '<div class="spinner" aria-label="Loading"></div>';
    document.body.appendChild(loader);
  }
  return loader;
};

const setAdminLoading = (isLoading) => {
  const loader = createAdminLoader();
  loader.classList.toggle("hidden", !isLoading);
};

const showToast = (message) => {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, 2200);
};

const renderSkeletonRows = (tbody, columns = 3, rows = 4) => {
  if (!tbody) return;
  tbody.innerHTML = "";
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = columns;
  td.innerHTML = '<div class="table-loader"><span class="table-loader-spinner" aria-hidden="true"></span><span>Loading data...</span></div>';
  tr.appendChild(td);
  tbody.appendChild(tr);
};

const setupAdminShell = () => {
  const logoutBtn = document.querySelector("[data-admin-logout]");
  if (logoutBtn && window.gtSupabase1) {
    logoutBtn.addEventListener("click", async () => {
      await window.gtSupabase1.auth.signOut();
      window.location.href = "login.html";
    });
  }
};

const loadAdminStats = async () => {
  const db1El = document.querySelector("[data-db1-count]");
  const db2El = document.querySelector("[data-db2-count]");
  const db3El = document.querySelector("[data-db3-count]");
  const db1SizeEl = document.querySelector("[data-db1-size]");
  const db2SizeEl = document.querySelector("[data-db2-size]");
  const db3SizeEl = document.querySelector("[data-db3-size]");
  if (!db1El && !db2El && !db3El) return;

  if (!window.gtSupabase1 || !window.gtSupabase2 || !window.gtSupabase3) {
    if (db1El) db1El.textContent = "Missing keys";
    if (db2El) db2El.textContent = "Missing keys";
    if (db3El) db3El.textContent = "Missing keys";
    if (db1SizeEl) db1SizeEl.textContent = "Missing keys";
    if (db2SizeEl) db2SizeEl.textContent = "Missing keys";
    if (db3SizeEl) db3SizeEl.textContent = "Missing keys";
    return;
  }

  const countTable = async (client, table) => {
    const { count } = await client.from(table).select("*", { count: "exact", head: true });
    return count || 0;
  };

  const formatBytes = (value) => {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  };

  const db1Tables = ["products", "home_sliders", "categories"];
  const db2Tables = ["blogs", "reviews", "offers"];
  const db3Tables = ["bookings", "booking_items", "payments", "addresses", "profiles"];

  const db1Counts = await Promise.all(db1Tables.map((t) => countTable(window.gtSupabase1, t)));
  const db2Counts = await Promise.all(db2Tables.map((t) => countTable(window.gtSupabase2, t)));
  const db3Counts = await Promise.all(db3Tables.map((t) => countTable(window.gtSupabase3, t)));

  const token = await window.getAdminAccessToken?.();
  const [db1Usage, db2Usage, db3Usage] = await Promise.allSettled([
    window.callSupabase1AdminFunction?.("admin-usage", { tables: db1Tables, buckets: ["product-images"] }),
    window.callSupabase2AdminFunction?.("admin-usage", { tables: db2Tables, buckets: ["product-images"] }),
    window.callSupabase3AdminFunction?.("admin-usage", { tables: db3Tables, buckets: [] }, token),
  ]);

  if (db1El) db1El.textContent = db1Counts.reduce((a, b) => a + b, 0);
  if (db2El) db2El.textContent = db2Counts.reduce((a, b) => a + b, 0);
  if (db3El) db3El.textContent = db3Counts.reduce((a, b) => a + b, 0);
  if (db1SizeEl) db1SizeEl.textContent = db1Usage.status === "fulfilled" ? formatBytes(db1Usage.value.total_bytes) : "Unavailable";
  if (db2SizeEl) db2SizeEl.textContent = db2Usage.status === "fulfilled" ? formatBytes(db2Usage.value.total_bytes) : "Unavailable";
  if (db3SizeEl) db3SizeEl.textContent = db3Usage.status === "fulfilled" ? formatBytes(db3Usage.value.total_bytes) : "Unavailable";
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.hasAttribute("data-admin-guard")) {
    window.requireAdminAuth?.();
  }
  setupAdminShell();
  setAdminLoading(true);
  loadAdminStats().finally(() => setAdminLoading(false));
});

window.setAdminLoading = setAdminLoading;
window.showToast = showToast;
window.renderSkeletonRows = renderSkeletonRows;
