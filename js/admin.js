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
  for (let i = 0; i < rows; i += 1) {
    const tr = document.createElement("tr");
    tr.className = "skeleton-row";
    for (let j = 0; j < columns; j += 1) {
      const td = document.createElement("td");
      td.innerHTML = '<div class="skeleton-line"></div>';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
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
  if (!db1El && !db2El) return;

  if (!window.gtSupabase1 || !window.gtSupabase2) {
    if (db1El) db1El.textContent = "Missing keys";
    if (db2El) db2El.textContent = "Missing keys";
    return;
  }

  const countTable = async (client, table) => {
    const { count } = await client.from(table).select("*", { count: "exact", head: true });
    return count || 0;
  };

  const db1Tables = ["products", "home_sliders", "categories", "blogs"];
  const db2Tables = ["reviews", "offers"];

  const db1Counts = await Promise.all(db1Tables.map((t) => countTable(window.gtSupabase1, t)));
  const db2Counts = await Promise.all(db2Tables.map((t) => countTable(window.gtSupabase2, t)));

  if (db1El) db1El.textContent = db1Counts.reduce((a, b) => a + b, 0);
  if (db2El) db2El.textContent = db2Counts.reduce((a, b) => a + b, 0);
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
