const productTableBody = document.querySelector("#product-table tbody");
const productForm = document.querySelector("#product-form");
const resetFormBtn = document.querySelector("#reset-form");
const statusEl = document.querySelector("#product-status");
const mainImageInput = document.querySelector("#main-image");
const galleryInput = document.querySelector("#gallery-images");
const mainImageStatus = document.querySelector("#main-image-status");
const galleryStatus = document.querySelector("#gallery-status");
const imagePreviewList = document.querySelector("#image-preview-list");
const customFieldsWrap = document.querySelector("#custom-fields");
const addCustomFieldBtn = document.querySelector("#add-custom-field");
const colorImageFields = document.querySelector("#color-image-fields");
const colorsInput = document.querySelector("#colors");

const STORAGE_BUCKET = "product-images";

let mainImageUrl = "";
let galleryUrls = [];
let customFields = [];
let colorImageMap = {};

const parseList = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return parseList(value);
  return [];
};

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

const isAllowedImage = (file) => {
  if (!file) return false;
  const type = (file.type || "").toLowerCase();
  if (type === "image/png" || type === "image/jpeg" || type === "image/webp") return true;
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp");
};

const fileToWebp = async (file) => {
  if (!file) return null;
  if (file.type === "image/webp") return file;
  if (!isAllowedImage(file)) return null;

  const bitmap = window.createImageBitmap ? await createImageBitmap(file) : null;
  if (bitmap) {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.9)
    );
    if (!blob) return null;
    return new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: "image/webp" });
  }

  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  const loaded = await new Promise((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = objectUrl;
  });
  URL.revokeObjectURL(objectUrl);
  if (!loaded) return null;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9)
  );
  if (!blob) return null;
  return new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: "image/webp" });
};

const uploadToStorage = async (file, slug) => {
  if (!window.gtSupabase1) return "";
  if (!isAllowedImage(file)) {
    setStatus("Only PNG, JPG/JPEG, or WEBP images are allowed.");
    return "";
  }
  const webpFile = await fileToWebp(file);
  if (!webpFile) {
    setStatus("Image conversion failed. Please try another image.");
    return "";
  }
  const fileName = sanitizeFileName(webpFile.name);
  const path = `products/${slug}/${Date.now()}_${fileName}`;
  const { error } = await window.gtSupabase1.storage.from(STORAGE_BUCKET).upload(path, webpFile, {
    cacheControl: "3600",
    upsert: true,
    contentType: "image/webp"
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
  Object.entries(colorImageMap).forEach(([color, url]) => {
    if (!url) return;
    items.push(`<div>Color ${color}: <a href="${url}" target="_blank" rel="noopener">${url}</a></div>`);
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

const renderCustomFields = () => {
  if (!customFieldsWrap) return;
  customFieldsWrap.innerHTML = "";
  if (!customFields.length) {
    customFieldsWrap.innerHTML = "<p class=\"small\">No extra fields yet.</p>";
    return;
  }
  customFields.forEach((field, index) => {
    const row = document.createElement("div");
    row.className = "custom-field-row";
    row.innerHTML = `
      <input type="text" placeholder="Field name" value="${field.label || ""}" data-custom-label="${index}" />
      <input type="text" placeholder="Field value" value="${field.value || ""}" data-custom-value="${index}" />
      <button class="btn link" type="button" data-remove-custom="${index}">Remove</button>
    `;
    customFieldsWrap.appendChild(row);
  });

  customFieldsWrap.querySelectorAll("[data-remove-custom]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.getAttribute("data-remove-custom"));
      customFields = customFields.filter((_, i) => i !== index);
      renderCustomFields();
    });
  });
};

const normalizeColorImages = (value) => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (error) {
      return {};
    }
  }
  if (typeof value === "object") return value;
  return {};
};

const renderColorImageFields = (colors) => {
  if (!colorImageFields) return;
  const list = (colors || []).filter(Boolean);
  colorImageFields.innerHTML = "";
  if (!list.length) {
    colorImageFields.innerHTML = "<p class=\"small\">Add colors above to upload matching images.</p>";
    return;
  }

  list.forEach((color) => {
    const safeColor = color.trim();
    const row = document.createElement("div");
    row.className = "color-image-row";
    row.innerHTML = `
      <div><strong>${safeColor}</strong></div>
      <div>
        <input type="file" accept="image/png,image/jpeg,image/webp" data-color-file="${safeColor}" />
      </div>
      <div>
        ${colorImageMap[safeColor] ? `<img src="${colorImageMap[safeColor]}" alt="${safeColor}">` : ""}
      </div>
    `;
    colorImageFields.appendChild(row);
  });

  colorImageFields.querySelectorAll("[data-color-file]").forEach((input) => {
    input.addEventListener("change", async () => {
      const color = input.getAttribute("data-color-file");
      if (!input.files?.length || !color) return;
      if (!isAllowedImage(input.files[0])) {
        setStatus("Only PNG, JPG/JPEG, or WEBP images are allowed.");
        return;
      }
      const slug = document.querySelector("#slug").value.trim() || "product";
      setStatus(`Uploading ${color} image...`);
      const url = await uploadToStorage(input.files[0], slug);
      if (url) {
        colorImageMap[color] = url;
        renderColorImageFields(list);
        renderImageList();
        window.showToast?.(`${color} image uploaded`);
      }
    });
  });
};

const readCustomFields = () => {
  if (!customFieldsWrap) return [];
  const labels = Array.from(customFieldsWrap.querySelectorAll("[data-custom-label]"));
  const values = Array.from(customFieldsWrap.querySelectorAll("[data-custom-value]"));
  return labels.map((input, index) => {
    return {
      label: input.value.trim(),
      value: (values[index]?.value || "").trim()
    };
  }).filter((item) => item.label && item.value);
};

const clearForm = () => {
  productForm.reset();
  document.querySelector("#product-id").value = "";
  document.querySelector("#is_active").checked = true;
  mainImageUrl = "";
  galleryUrls = [];
  customFields = [];
  colorImageMap = {};
  if (mainImageInput) mainImageInput.value = "";
  if (galleryInput) galleryInput.value = "";
  renderImageList();
  renderCustomFields();
  renderColorImageFields([]);
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

const normalizeSpecs = (specs) => {
  if (Array.isArray(specs)) return specs;
  if (specs && typeof specs === "object") {
    return Object.entries(specs).map(([label, value]) => ({ label, value }));
  }
  return [];
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
  document.querySelector("#colors").value = normalizeList(product.colors).join(", ");
  document.querySelector("#home_sections").value = normalizeList(product.home_sections).join(", ");
  document.querySelector("#is_active").checked = product.is_active !== false;

  mainImageUrl = (product.images || [])[0] || "";
  galleryUrls = product.gallery || [];
  customFields = normalizeSpecs(product.specs);
  colorImageMap = normalizeColorImages(product.color_images);
  renderImageList();
  renderCustomFields();
  renderColorImageFields(parseList(document.querySelector("#colors").value));
};

if (mainImageInput) {
  mainImageInput.addEventListener("change", async () => {
    if (!mainImageInput.files?.length) return;
    if (!isAllowedImage(mainImageInput.files[0])) {
      setMainStatus("Only PNG, JPG/JPEG, or WEBP images are allowed.");
      return;
    }
    const slug = document.querySelector("#slug").value.trim() || "product";
    setMainStatus("Converting to WEBP...");
    const url = await uploadToStorage(mainImageInput.files[0], slug);
    if (url) {
      mainImageUrl = url;
      if (!galleryUrls.includes(url)) {
        galleryUrls = [url, ...galleryUrls];
      }
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
    const allFiles = Array.from(galleryInput.files);
    const invalid = allFiles.filter((file) => !isAllowedImage(file));
    if (invalid.length) {
      setGalleryStatus("Only PNG, JPG/JPEG, or WEBP images are allowed.");
      return;
    }
    const files = allFiles.slice(0, 5 - galleryUrls.length);
    if (!files.length) {
      setGalleryStatus("Gallery limit reached (5 images). Remove one to add more.");
      return;
    }
    setGalleryStatus("Converting to WEBP...");
    for (const file of files) {
      const url = await uploadToStorage(file, slug);
      if (url) galleryUrls.push(url);
    }
    setGalleryStatus("Gallery updated.");
    window.showToast?.("Gallery updated");
    renderImageList();
  });
}

if (colorsInput) {
  colorsInput.addEventListener("input", () => {
    const list = parseList(colorsInput.value);
    const nextMap = {};
    list.forEach((color) => {
      const key = color.trim();
      if (colorImageMap[key]) nextMap[key] = colorImageMap[key];
    });
    colorImageMap = nextMap;
    renderColorImageFields(list);
    renderImageList();
  });
}

if (addCustomFieldBtn) {
  addCustomFieldBtn.addEventListener("click", () => {
    customFields.push({ label: "", value: "" });
    renderCustomFields();
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
      gallery: [mainImageUrl, ...galleryUrls.filter((url) => url && url !== mainImageUrl)].filter(Boolean),
      colors: parseList(document.querySelector("#colors").value),
      home_sections: parseList(document.querySelector("#home_sections").value),
      specs: readCustomFields(),
      color_images: colorImageMap,
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
renderCustomFields();
renderColorImageFields(parseList(colorsInput?.value || ""));
loadProducts();
