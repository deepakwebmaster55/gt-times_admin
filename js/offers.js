const offerForm = document.querySelector("#offer-form");
const offerReset = document.querySelector("#offer-reset");
const offerStatus = document.querySelector("#offer-status");
const offerTableBody = document.querySelector("#offer-table tbody");

const offerTypeSelect = document.querySelector("#offer-type");
const discountBlock = document.querySelector('[data-offer-block="discount"]');
const bogoBlock = document.querySelector('[data-offer-block="bogo"]');

const discountProduct = document.querySelector("#discount-product");
const discountType = document.querySelector("#discount-type");
const discountValue = document.querySelector("#discount-value");

const buyQty = document.querySelector("#buy-qty");
const buyProduct = document.querySelector("#buy-product");
const getQty = document.querySelector("#get-qty");
const getProduct = document.querySelector("#get-product");

let productsCache = [];

const setOfferStatus = (message) => {
  if (offerStatus) offerStatus.textContent = message;
};

const toggleOfferBlocks = () => {
  const type = offerTypeSelect?.value || "discount";
  if (discountBlock) discountBlock.style.display = type === "discount" ? "block" : "none";
  if (bogoBlock) bogoBlock.style.display = type === "bogo" ? "block" : "none";
};

const resetOfferForm = () => {
  offerForm.reset();
  document.querySelector("#offer-id").value = "";
  document.querySelector("#offer-active").checked = true;
  discountValue.value = "";
  buyQty.value = "1";
  getQty.value = "1";
  toggleOfferBlocks();
};

const populateProductSelects = () => {
  const selects = [discountProduct, buyProduct, getProduct];
  selects.forEach((select) => {
    if (!select) return;
    select.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select product";
    select.appendChild(defaultOption);

    productsCache.forEach((product) => {
      const option = document.createElement("option");
      option.value = product.id;
      option.textContent = product.title || product.slug || "Product";
      select.appendChild(option);
    });
  });
};

const loadProducts = async () => {
  if (!window.gtSupabase1) return;
  const { data } = await window.gtSupabase1.from("products").select("id,title,slug").eq("is_active", true);
  productsCache = data || [];
  populateProductSelects();
};

const loadOffers = async () => {
  window.setAdminLoading?.(true);
  window.renderSkeletonRows?.(offerTableBody, 4, 4);
  try {
    if (!window.gtSupabase2) {
      setOfferStatus("Supabase 2 keys missing in admin/js/config.js");
      return;
    }
    const { data, error } = await window.gtSupabase2
      .from("offers")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      setOfferStatus(error.message);
      return;
    }

    offerTableBody.innerHTML = "";
    (data || []).forEach((offer) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${offer.title || ""}</td>
        <td>${offer.type || "discount"}</td>
        <td><span class="badge">${offer.is_active ? "Active" : "Inactive"}</span></td>
        <td>
          <div class="actions-row">
            <button class="btn secondary" data-edit="${offer.id}">Edit</button>
            <button class="btn link" data-delete="${offer.id}">Delete</button>
          </div>
        </td>
      `;
      offerTableBody.appendChild(row);
    });

    offerTableBody.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-edit");
        const { data: row, error: rowError } = await window.gtSupabase2
          .from("offers")
          .select("*")
          .eq("id", id)
          .single();
        if (rowError) {
          setOfferStatus(rowError.message);
          return;
        }
        document.querySelector("#offer-id").value = row.id || "";
        document.querySelector("#offer-title").value = row.title || "";
        document.querySelector("#offer-description").value = row.description || "";
        document.querySelector("#offer-badge").value = row.badge || "";
        document.querySelector("#offer-code").value = row.code || "";
        offerTypeSelect.value = row.type || "discount";
        document.querySelector("#offer-active").checked = row.is_active !== false;

        const rules = row.rules || {};
        if (row.type === "discount") {
          discountProduct.value = rules.product_id || "";
          discountType.value = rules.discount_type || "percent";
          discountValue.value = rules.discount_value || "";
        } else {
          buyQty.value = rules.buy_qty || "1";
          buyProduct.value = rules.buy_product_id || "";
          getQty.value = rules.get_qty || "1";
          getProduct.value = rules.get_product_id || "";
        }
        toggleOfferBlocks();
      });
    });

    offerTableBody.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete");
        if (!confirm("Delete this offer?")) return;
        try {
          await window.callSupabase2AdminFunction("admin-offers", { action: "delete", id });
          window.showToast?.("Offer deleted.");
          loadOffers();
        } catch (error) {
          setOfferStatus(error.message || "Delete failed.");
        }
      });
    });
  } finally {
    window.setAdminLoading?.(false);
  }
};

if (offerTypeSelect) {
  offerTypeSelect.addEventListener("change", toggleOfferBlocks);
}

if (offerForm) {
  offerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!window.gtSupabase2) {
      setOfferStatus("Supabase 2 keys missing in admin/js/config.js");
      return;
    }

    const type = offerTypeSelect.value;
    const rules = type === "bogo"
      ? {
          buy_qty: Number(buyQty.value || 1),
          buy_product_id: buyProduct.value || null,
          get_qty: Number(getQty.value || 1),
          get_product_id: getProduct.value || null
        }
      : {
          product_id: discountProduct.value || null,
          discount_type: discountType.value || "percent",
          discount_value: Number(discountValue.value || 0)
        };

    const payload = {
      id: document.querySelector("#offer-id").value || undefined,
      title: document.querySelector("#offer-title").value.trim(),
      description: document.querySelector("#offer-description").value.trim(),
      badge: document.querySelector("#offer-badge").value.trim(),
      code: document.querySelector("#offer-code").value.trim(),
      type,
      rules,
      is_active: document.querySelector("#offer-active").checked
    };

    if (!payload.title) {
      setOfferStatus("Title is required.");
      return;
    }

    window.setAdminLoading?.(true);
    try {
      await window.callSupabase2AdminFunction("admin-offers", {
        action: "upsert",
        offer: payload
      });
      setOfferStatus("Offer saved.");
      window.showToast?.("Offer saved.");
      resetOfferForm();
      loadOffers();
    } catch (error) {
      setOfferStatus(error.message || "Save failed.");
    } finally {
      window.setAdminLoading?.(false);
    }
  });
}

if (offerReset) {
  offerReset.addEventListener("click", resetOfferForm);
}

toggleOfferBlocks();
loadProducts();
loadOffers();
