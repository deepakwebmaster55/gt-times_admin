const productTableBody = document.querySelector("#product-table tbody");
const productForm = document.querySelector("#product-form");
const resetFormBtn = document.querySelector("#reset-form");
const statusEl = document.querySelector("#product-status");
const mainImageInput = document.querySelector("#main-image");
const galleryInput = document.querySelector("#gallery-images");
const mainImageStatus = document.querySelector("#main-image-status");
const galleryStatus = document.querySelector("#gallery-status");
const imagePreviewList = document.querySelector("#image-preview-list");

const STORAGE_BUCKET = "product-images";

let mainImageUrl = "";
let galleryUrls = [];

const parseList = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const setStatus = (message) => {
  if (statusEl) statusEl.textContent = message;
};

const setMainStatus = (message) => {
  if (mainImageStatus) mainImageStatus.textContent = message;
};

const setGalleryStatus = (message) => {
  if (galleryStatus) galleryStatus.textContent = message;
};

const sanitizeFileName = (name) => name.replace(/[^a-z0-9._-]/gi, "_");

const uploadToStorage = async (file, slug) => {
  if (!window.gtSupabase1) return "";
  const fileName = sanitizeFileName(file.name);
  const path = `products/${slug}/${Date.now()}_${fileName}`;
  const { error } = await window.gtSupabase1.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true
  });
  if (error) {
    setStatus(error.message);
    return "";
  }
  const { data } = window.gtSupabase1.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
};

const renderImageList = () => {
  if (!imagePreviewList) return;
  const items = [];
  if (mainImageUrl) {
    items.push(`<div>Main: <a href="${mainImageUrl}" target="_blank" rel="noopener">${mainImageUrl}</a></div>`);
  }
  galleryUrls.forEach((url, index) => {
    items.push(`<div>Gallery ${index + 1}: <a href="${url}" target="_blank" rel="noopener">${url}</a>
      <button class="btn link" data-remove-gallery="${index}">Remove</button>
    </div>`);
  });
  imagePreviewList.innerHTML = items.join("") || "No images uploaded yet.";

  imagePreviewList.querySelectorAll("[data-remove-gallery]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.getAttribute("data-remove-gallery"));
      galleryUrls = galleryUrls.filter((_, i) => i !== index);
      renderImageList();
    });
  });
};

const clearForm = () => {
  productForm.reset();
  document.querySelector("#product-id").value = "";
  document.querySelector("#is_active").checked = true;
  mainImageUrl = "";
  galleryUrls = [];
  if (mainImageInput) mainImageInput.value = "";
  if (galleryInput) galleryInput.value = "";
  renderImageList();
};

const loadProducts = async () => {
  window.setAdminLoading?.(true);
  window.renderSkeletonRows?.(productTableBody, 4, 4);

  if (!window.gtSupabase1) {
    setStatus("Supabase 1 keys missing in admin/js/config.js");
    return;
  }
  const { data, error } = await window.gtSupabase1
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    setStatus(error.message);
    return;
  }

  renderProducts(data || []);
  window.setAdminLoading?.(false);
};

const renderProducts = (products) => {
  productTableBody.innerHTML = "";
  products.forEach((product) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${product.title || ""}</td>
      <td>${product.category || ""}</td>
      <td><span class="badge">${product.is_active ? "Active" : "Inactive"}</span></td>
      <td>
        <div class="actions-row">
          <button class="btn secondary" data-edit="${product.id}">Edit</button>
          <button class="btn link" data-delete="${product.id}">Delete</button>
        </div>
      </td>
    `;
    productTableBody.appendChild(row);
  });

  productTableBody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit");
      const { data, error } = await window.gtSupabase1
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        setStatus(error.message);
        return;
      }
      fillForm(data);
    });
  });

  productTableBody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete");
      if (!confirm("Delete this product?")) return;
      const { error } = await window.gtSupabase1.from("products").delete().eq("id", id);
      if (error) {
        setStatus(error.message);
        return;
      }
      loadProducts();
    });
  });
};

const fillForm = (product) => {
  document.querySelector("#product-id").value = product.id || "";
  document.querySelector("#title").value = product.title || "";
  document.querySelector("#slug").value = product.slug || "";
  document.querySelector("#subtitle").value = product.subtitle || "";
  document.querySelector("#category").value = product.category || "";
  document.querySelector("#price").value = product.price || "";
  document.querySelector("#old_price").value = product.old_price || "";
  document.querySelector("#rating").value = product.rating || "";
  document.querySelector("#badge").value = product.badge || "";
  document.querySelector("#short_desc").value = product.short_desc || "";
  document.querySelector("#description").value = product.description || "";
  document.querySelector("#stock").value = product.stock || "";
  document.querySelector("#colors").value = (product.colors || []).join(", ");
  document.querySelector("#home_sections").value = (product.home_sections || []).join(", ");
  document.querySelector("#is_active").checked = product.is_active !== false;

  mainImageUrl = (product.images || [])[0] || "";
  galleryUrls = product.gallery || [];
  renderImageList();
};

if (mainImageInput) {
  mainImageInput.addEventListener("change", async () => {
    if (!mainImageInput.files?.length) return;
    const slug = document.querySelector("#slug").value.trim() || "product";
    setMainStatus("Uploading main image...");
    const url = await uploadToStorage(mainImageInput.files[0], slug);
    if (url) {
      mainImageUrl = url;
      setMainStatus("Main image uploaded.");
      window.showToast?.("Main image uploaded");
    }
    renderImageList();
  });
}

if (galleryInput) {
  galleryInput.addEventListener("change", async () => {
    if (!galleryInput.files?.length) return;
    const slug = document.querySelector("#slug").value.trim() || "product";
    const files = Array.from(galleryInput.files).slice(0, 5 - galleryUrls.length);
    if (!files.length) {
      setGalleryStatus("Gallery limit reached (5 images). Remove one to add more.");
      return;
    }
    setGalleryStatus("Uploading gallery images...");
    for (const file of files) {
      const url = await uploadToStorage(file, slug);
      if (url) galleryUrls.push(url);
    }
    setGalleryStatus("Gallery updated.");
    window.showToast?.("Gallery updated");
    renderImageList();
  });
}

if (resetFormBtn) {
  resetFormBtn.addEventListener("click", clearForm);
}

if (productForm) {
  productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!window.gtSupabase1) {
      setStatus("Supabase 1 keys missing in admin/js/config.js");
      return;
    }

    const payload = {
      id: document.querySelector("#product-id").value || undefined,
      title: document.querySelector("#title").value.trim(),
      slug: document.querySelector("#slug").value.trim(),
      subtitle: document.querySelector("#subtitle").value.trim(),
      category: document.querySelector("#category").value.trim(),
      price: Number(document.querySelector("#price").value || 0),
      old_price: Number(document.querySelector("#old_price").value || 0),
      rating: Number(document.querySelector("#rating").value || 0),
      badge: document.querySelector("#badge").value.trim(),
      short_desc: document.querySelector("#short_desc").value.trim(),
      description: document.querySelector("#description").value.trim(),
      stock: document.querySelector("#stock").value.trim(),
      images: mainImageUrl ? [mainImageUrl] : [],
      gallery: galleryUrls,
      colors: parseList(document.querySelector("#colors").value),
      home_sections: parseList(document.querySelector("#home_sections").value),
      is_active: document.querySelector("#is_active").checked
    };

    if (!payload.title || !payload.slug) {
      setStatus("Title and slug are required.");
      return;
    }

    const { error } = await window.gtSupabase1.from("products").upsert(payload, { onConflict: "slug" });
    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Product saved.");
    window.showToast?.("Product saved.");
    clearForm();
    loadProducts();
  });
}

renderImageList();
loadProducts();
