const stockTableBody = document.querySelector("#stock-table tbody");
const stockStatus = document.querySelector("#stock-status");

const setStockStatus = (message) => {
  if (stockStatus) stockStatus.textContent = message;
};

const normalizeImages = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((item) => item.replace(/^\"|\"$/g, "").trim())
        .filter(Boolean);
    }
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [trimmed];
      }
    }
    return [trimmed];
  }
  return [];
};

const formatDateTime = (value) => {
  if (!value) return "Not updated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not updated";
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
};

const loadStocks = async () => {
  if (!window.gtSupabase1) {
    setStockStatus("Supabase 1 keys missing in admin/js/config.js");
    return;
  }

  window.setAdminLoading?.(true);
  window.renderSkeletonRows?.(stockTableBody, 6, 6);
  try {
    const { data, error } = await window.gtSupabase1
      .from("products")
      .select("id, title, images, stock_quantity, stock_updated_at, is_active")
      .order("created_at", { ascending: false });

    if (error) {
      setStockStatus(error.message);
      return;
    }

    stockTableBody.innerHTML = "";

    (data || []).forEach((product) => {
    const image = normalizeImages(product.images)[0] || "../assets/images/logo.svg";
    const stock = Number(product.stock_quantity || 0);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><img src="${image}" alt="${product.title || "Product"}" class="admin-stock-thumb" /></td>
      <td>${product.title || ""}</td>
      <td>
        <input
          type="number"
          min="0"
          step="1"
          value="${stock}"
          class="admin-stock-input"
          data-stock-input="${product.id}"
        />
      </td>
      <td>${formatDateTime(product.stock_updated_at)}</td>
      <td>
        <span class="status-badge ${product.is_active === false ? "danger" : stock <= 0 ? "pending" : "success"}">
          ${product.is_active === false ? "Inactive" : stock <= 0 ? "Out Of Stock" : "Active"}
        </span>
      </td>
      <td>
        <div class="actions-row">
          <button class="btn secondary" type="button" data-save-stock="${product.id}">Save Stock</button>
          <button class="btn link" type="button" data-toggle-active="${product.id}" data-next-active="${product.is_active === false ? "true" : "false"}">
            ${product.is_active === false ? "Activate" : "Deactivate"}
          </button>
        </div>
      </td>
    `;
    stockTableBody.appendChild(row);
    });

    stockTableBody.querySelectorAll("[data-save-stock]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-save-stock");
        const input = stockTableBody.querySelector(`[data-stock-input="${id}"]`);
        const nextStock = Math.max(0, Number(input?.value || 0));
        const { error } = await window.gtSupabase1
          .from("products")
          .update({
            stock_quantity: nextStock,
            stock_updated_at: new Date().toISOString(),
            stock: nextStock > 0 ? "In stock" : "Out of stock"
          })
          .eq("id", id);

        if (error) {
          setStockStatus(error.message);
          return;
        }

        setStockStatus("Stock updated.");
        window.showToast?.("Stock updated.");
        loadStocks();
      });
    });

    stockTableBody.querySelectorAll("[data-toggle-active]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-toggle-active");
        const nextActive = button.getAttribute("data-next-active") === "true";
        const { error } = await window.gtSupabase1
          .from("products")
          .update({
            is_active: nextActive,
            stock_updated_at: new Date().toISOString()
          })
          .eq("id", id);

        if (error) {
          setStockStatus(error.message);
          return;
        }

        setStockStatus(nextActive ? "Product activated." : "Product deactivated.");
        window.showToast?.(nextActive ? "Product activated." : "Product deactivated.");
        loadStocks();
      });
    });
  } finally {
    window.setAdminLoading?.(false);
  }
};

loadStocks();
