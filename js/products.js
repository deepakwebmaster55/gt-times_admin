const productTableBody = document.querySelector("#product-table tbody");
const productForm = document.querySelector("#product-form");
const resetFormBtn = document.querySelector("#reset-form");
const statusEl = document.querySelector("#product-status");
const mainImageInput = document.querySelector("#main-image");
const galleryInput = document.querySelector("#gallery-images");
const mainImageStatus = document.querySelector("#main-image-status");
const galleryStatus = document.querySelector("#gallery-status");
const imagePreviewList = document.querySelector("#image-preview-list");
const mainImagePreview = document.querySelector("#main-image-preview");
const galleryImagePreview = document.querySelector("#gallery-image-preview");
const customFieldsWrap = document.querySelector("#custom-fields");
const addCustomFieldBtn = document.querySelector("#add-custom-field");
const colorImageFields = document.querySelector("#color-image-fields");
const colorsInput = document.querySelector("#colors");
const categoryHiddenInput = document.querySelector("#category");
const categorySelect = document.querySelector("#category-select");
const categoryTags = document.querySelector("#category-tags");
const addCategoryTagBtn = document.querySelector("#add-category-tag");
const homeSectionsHiddenInput = document.querySelector("#home_sections");
const homeSectionsSelect = document.querySelector("#home-sections-select");
const homeSectionTags = document.querySelector("#home-section-tags");
const addSectionTagBtn = document.querySelector("#add-section-tag");
const productSizeEstimateEl = document.querySelector("#product-size-estimate");
const cropperModal = document.querySelector("#image-cropper-modal");
const cropperStage = document.querySelector("#cropper-stage");
const cropperImage = document.querySelector("#cropper-image");
const cropperZoom = document.querySelector("#cropper-zoom");
const cropperApplyBtn = document.querySelector("#cropper-apply");
const cropperCancelBtn = document.querySelector("#cropper-cancel");
const cropperCancelTopBtn = document.querySelector("#cropper-cancel-top");
const cropperResetBtn = document.querySelector("#cropper-reset");
const cropperRatioButtons = Array.from(document.querySelectorAll("[data-crop-ratio]"));

const STORAGE_BUCKET = "product-images";
const MAX_TOTAL_IMAGES = 5;
const MAX_GALLERY_IMAGES = MAX_TOTAL_IMAGES - 1;
const CROP_PRESETS = {
  showcase: { label: "Showcase / Hero", ratio: 14 / 9 },
  card: { label: "Product Card", ratio: 4 / 3 }
};

let mainImageUrl = "";
let galleryUrls = [];
let customFields = [];
let colorImageMap = {};
let categoriesCache = [];
let selectedCategories = [];
let selectedHomeSections = [];
let mediaSizeBytes = {
  main: 0,
  gallery: [],
  colors: {}
};
let cropperSession = null;

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

const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const updateTagHiddenInput = (target, values) => {
  if (!target) return;
  target.value = values.join(", ");
};

const renderTagList = (wrap, values, removeHandler) => {
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!values.length) {
    wrap.innerHTML = "<span class=\"small\">No items selected yet.</span>";
    return;
  }
  values.forEach((value, index) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.innerHTML = `
      ${value}
      <button type="button" data-remove="${index}" aria-label="Remove ${value}">×</button>
    `;
    wrap.appendChild(chip);
  });
  wrap.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.getAttribute("data-remove"));
      removeHandler(index);
    });
  });
};

const addCategoryTag = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return;
  if (selectedCategories.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return;
  selectedCategories.push(trimmed);
  updateTagHiddenInput(categoryHiddenInput, selectedCategories);
  renderTagList(categoryTags, selectedCategories, (index) => {
    selectedCategories.splice(index, 1);
    updateTagHiddenInput(categoryHiddenInput, selectedCategories);
    renderTagList(categoryTags, selectedCategories, (idx) => {
      selectedCategories.splice(idx, 1);
      updateTagHiddenInput(categoryHiddenInput, selectedCategories);
      renderTagList(categoryTags, selectedCategories, () => {});
      updateProductSizeEstimate();
    });
    updateProductSizeEstimate();
  });
  updateProductSizeEstimate();
};

const addHomeSectionTag = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return;
  if (selectedHomeSections.includes(trimmed)) return;
  selectedHomeSections.push(trimmed);
  updateTagHiddenInput(homeSectionsHiddenInput, selectedHomeSections);
  renderTagList(homeSectionTags, selectedHomeSections, (index) => {
    selectedHomeSections.splice(index, 1);
    updateTagHiddenInput(homeSectionsHiddenInput, selectedHomeSections);
    renderTagList(homeSectionTags, selectedHomeSections, (idx) => {
      selectedHomeSections.splice(idx, 1);
      updateTagHiddenInput(homeSectionsHiddenInput, selectedHomeSections);
      renderTagList(homeSectionTags, selectedHomeSections, () => {});
      updateProductSizeEstimate();
    });
    updateProductSizeEstimate();
  });
  updateProductSizeEstimate();
};

const sanitizeFileName = (name) => name.replace(/[^a-z0-9._-]/gi, "_");

const isAllowedImage = (file) => {
  if (!file) return false;
  const type = (file.type || "").toLowerCase();
  if (type === "image/png" || type === "image/jpeg" || type === "image/webp") return true;
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp");
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getCropPreset = (key) => CROP_PRESETS[key] || CROP_PRESETS.showcase;

const renderCropRatioButtons = (activeKey) => {
  cropperRatioButtons.forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-crop-ratio") === activeKey);
  });
};

const applyCropLayout = () => {
  if (!cropperSession || !cropperStage) return;
  const preset = getCropPreset(cropperSession.ratioKey);
  cropperStage.style.aspectRatio = String(preset.ratio);
};

const resetCropperView = () => {
  if (!cropperSession || !cropperStage) return;
  const preset = getCropPreset(cropperSession.ratioKey);
  const stageRect = cropperStage.getBoundingClientRect();
  const stageWidth = stageRect.width || 700;
  const stageHeight = stageRect.height || Math.round(stageWidth / preset.ratio);
  const baseScale = Math.max(stageWidth / cropperSession.image.naturalWidth, stageHeight / cropperSession.image.naturalHeight);
  cropperSession.baseWidth = cropperSession.image.naturalWidth * baseScale;
  cropperSession.baseHeight = cropperSession.image.naturalHeight * baseScale;
  cropperSession.displayWidth = cropperSession.baseWidth;
  cropperSession.displayHeight = cropperSession.baseHeight;
  cropperSession.zoom = 1;
  cropperSession.stageWidth = stageWidth;
  cropperSession.stageHeight = stageHeight;
  cropperSession.offsetX = (stageWidth - cropperSession.displayWidth) / 2;
  cropperSession.offsetY = (stageHeight - cropperSession.displayHeight) / 2;
  if (cropperZoom) cropperZoom.value = "1";
  renderCropRatioButtons(cropperSession.ratioKey);
  clampCropperOffsets();
};

const updateCropperTransform = () => {
  if (!cropperSession || !cropperImage) return;
  cropperImage.style.width = `${cropperSession.displayWidth}px`;
  cropperImage.style.height = `${cropperSession.displayHeight}px`;
  cropperImage.style.transform = `translate(${cropperSession.offsetX}px, ${cropperSession.offsetY}px)`;
};

const clampCropperOffsets = () => {
  if (!cropperSession || !cropperStage) return;
  const stageRect = cropperStage.getBoundingClientRect();
  cropperSession.stageWidth = stageRect.width;
  cropperSession.stageHeight = stageRect.height;
  const minX = Math.min(0, cropperSession.stageWidth - cropperSession.displayWidth);
  const minY = Math.min(0, cropperSession.stageHeight - cropperSession.displayHeight);
  cropperSession.offsetX = clamp(cropperSession.offsetX, minX, 0);
  cropperSession.offsetY = clamp(cropperSession.offsetY, minY, 0);
  updateCropperTransform();
};

const closeCropper = () => {
  if (!cropperSession) return;
  if (cropperSession.objectUrl) URL.revokeObjectURL(cropperSession.objectUrl);
  cropperSession = null;
  if (cropperModal) {
    cropperModal.classList.add("hidden");
    cropperModal.setAttribute("aria-hidden", "true");
  }
  if (cropperImage) {
    cropperImage.removeAttribute("src");
    cropperImage.style.transform = "";
    cropperImage.style.width = "";
    cropperImage.style.height = "";
  }
  if (cropperZoom) cropperZoom.value = "1";
  cropperStage?.classList.remove("is-dragging");
};

const setCropperZoom = (nextZoom, anchorX, anchorY) => {
  if (!cropperSession || !cropperStage) return;
  const stageRect = cropperStage.getBoundingClientRect();
  const pointerX = Number.isFinite(anchorX) ? anchorX : stageRect.width / 2;
  const pointerY = Number.isFinite(anchorY) ? anchorY : stageRect.height / 2;
  const prevWidth = cropperSession.displayWidth;
  const prevHeight = cropperSession.displayHeight;
  const ratioX = prevWidth ? (pointerX - cropperSession.offsetX) / prevWidth : 0.5;
  const ratioY = prevHeight ? (pointerY - cropperSession.offsetY) / prevHeight : 0.5;
  cropperSession.zoom = clamp(nextZoom, 1, 3);
  cropperSession.displayWidth = cropperSession.baseWidth * cropperSession.zoom;
  cropperSession.displayHeight = cropperSession.baseHeight * cropperSession.zoom;
  cropperSession.offsetX = pointerX - (cropperSession.displayWidth * ratioX);
  cropperSession.offsetY = pointerY - (cropperSession.displayHeight * ratioY);
  clampCropperOffsets();
};

const exportCroppedFile = async () => {
  if (!cropperSession) return null;
  const { image, offsetX, offsetY, displayWidth, displayHeight, stageWidth, stageHeight, file } = cropperSession;
  const scaleX = displayWidth / image.naturalWidth;
  const scaleY = displayHeight / image.naturalHeight;
  const srcX = clamp((0 - offsetX) / scaleX, 0, image.naturalWidth - 1);
  const srcY = clamp((0 - offsetY) / scaleY, 0, image.naturalHeight - 1);
  const srcW = clamp(stageWidth / scaleX, 1, image.naturalWidth - srcX);
  const srcH = clamp(stageHeight / scaleY, 1, image.naturalHeight - srcY);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(srcW));
  canvas.height = Math.max(1, Math.round(srcH));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.96));
  if (!blob) return null;
  return new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: "image/webp" });
};

const openCropper = (file, ratioKey = "showcase") => new Promise((resolve) => {
  if (!cropperModal || !cropperStage || !cropperImage || !cropperZoom) {
    resolve(file);
    return;
  }
  const objectUrl = URL.createObjectURL(file);
  const previewImage = new Image();
  previewImage.onload = () => {
    cropperModal.classList.remove("hidden");
    cropperModal.setAttribute("aria-hidden", "false");
    cropperSession = {
      resolve,
      objectUrl,
      file,
      image: previewImage,
      ratioKey,
      baseWidth: 0,
      baseHeight: 0,
      displayWidth: 0,
      displayHeight: 0,
      stageWidth: 0,
      stageHeight: 0,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      dragPointerId: null,
      dragStartX: 0,
      dragStartY: 0,
      startOffsetX: 0,
      startOffsetY: 0
    };
    applyCropLayout();
    cropperImage.src = objectUrl;
    resetCropperView();
  };
  previewImage.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(null);
  };
  previewImage.src = objectUrl;
});

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
  if (!window.gtSupabase1) return { url: "", size: 0 };
  if (!isAllowedImage(file)) {
    setStatus("Only PNG, JPG/JPEG, or WEBP images are allowed.");
    return { url: "", size: 0 };
  }
  const webpFile = await fileToWebp(file);
  if (!webpFile) {
    setStatus("Image conversion failed. Please try another image.");
    return { url: "", size: 0 };
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
    return { url: "", size: 0 };
  }
  const { data } = window.gtSupabase1.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return {
    url: data?.publicUrl || "",
    size: Number(webpFile.size || 0)
  };
};

const prepareImageForUpload = async (file, ratioKey) => {
  const croppedFile = await openCropper(file, ratioKey);
  if (!croppedFile) return null;
  if (croppedFile.type === "image/webp") return croppedFile;
  return fileToWebp(croppedFile);
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
      mediaSizeBytes.gallery = mediaSizeBytes.gallery.filter((_, i) => i !== index);
      renderImageList();
      updateProductSizeEstimate();
    });
  });

  if (mainImagePreview) {
    mainImagePreview.innerHTML = mainImageUrl
      ? `<div class="admin-thumb"><img src="${mainImageUrl}" alt="Main image preview" /><span>Main</span></div>`
      : "<span class=\"small\">Main image preview will appear here.</span>";
  }

  if (galleryImagePreview) {
    galleryImagePreview.innerHTML = galleryUrls.length
      ? galleryUrls.map((url, index) => `<div class="admin-thumb"><img src="${url}" alt="Gallery preview ${index + 1}" /><span>G${index + 1}</span></div>`).join("")
      : "<span class=\"small\">Gallery previews will appear here.</span>";
  }
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
      updateProductSizeEstimate();
    });
  });

  customFieldsWrap.querySelectorAll("[data-custom-label], [data-custom-value]").forEach((input) => {
    input.addEventListener("input", updateProductSizeEstimate);
    input.addEventListener("change", updateProductSizeEstimate);
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
      setStatus(`Crop and upload ${color} image...`);
      const preparedFile = await prepareImageForUpload(input.files[0], "card");
      if (!preparedFile) {
        setStatus(`${color} image crop canceled.`);
        input.value = "";
        return;
      }
      const upload = await uploadToStorage(preparedFile, slug);
      if (upload.url) {
        colorImageMap[color] = upload.url;
        mediaSizeBytes.colors[color] = upload.size;
        renderColorImageFields(list);
        renderImageList();
        window.showToast?.(`${color} image uploaded`);
        updateProductSizeEstimate();
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

const getDraftPayload = () => ({
  id: document.querySelector("#product-id")?.value || undefined,
  title: document.querySelector("#title")?.value.trim() || "",
  slug: document.querySelector("#slug")?.value.trim() || "",
  subtitle: document.querySelector("#subtitle")?.value.trim() || "",
  category: categoryHiddenInput?.value.trim() || "",
  price: Number(document.querySelector("#price")?.value || 0),
  old_price: Number(document.querySelector("#old_price")?.value || 0),
  rating: Number(document.querySelector("#rating")?.value || 0),
  badge: document.querySelector("#badge")?.value.trim() || "",
  short_desc: document.querySelector("#short_desc")?.value.trim() || "",
  description: document.querySelector("#description")?.value.trim() || "",
  stock: document.querySelector("#stock")?.value.trim() || "",
  stock_quantity: Math.max(0, Number(document.querySelector("#stock_quantity")?.value || 0)),
  images: mainImageUrl ? [mainImageUrl] : [],
  gallery: galleryUrls.filter((url) => url && url !== mainImageUrl),
  colors: parseList(document.querySelector("#colors")?.value || ""),
  home_sections: parseList(homeSectionsHiddenInput?.value || ""),
  specs: readCustomFields(),
  color_images: colorImageMap,
  is_active: document.querySelector("#is_active")?.checked === true
});

const updateProductSizeEstimate = () => {
  if (!productSizeEstimateEl) return;
  const payloadBytes = new TextEncoder().encode(JSON.stringify(getDraftPayload())).length;
  const galleryBytes = mediaSizeBytes.gallery.reduce((sum, size) => sum + Number(size || 0), 0);
  const colorBytes = Object.values(mediaSizeBytes.colors).reduce((sum, size) => sum + Number(size || 0), 0);
  const totalBytes = payloadBytes + Number(mediaSizeBytes.main || 0) + galleryBytes + colorBytes;
  productSizeEstimateEl.textContent = `Estimated product size: ${formatBytes(totalBytes)} (data + images)`;
};

const clearForm = () => {
  productForm.reset();
  document.querySelector("#product-id").value = "";
  document.querySelector("#is_active").checked = true;
  if (document.querySelector("#stock_quantity")) {
    document.querySelector("#stock_quantity").value = "0";
  }
  mainImageUrl = "";
  galleryUrls = [];
  customFields = [];
  colorImageMap = {};
  mediaSizeBytes = { main: 0, gallery: [], colors: {} };
  selectedCategories = [];
  selectedHomeSections = [];
  if (mainImageInput) mainImageInput.value = "";
  if (galleryInput) galleryInput.value = "";
  renderImageList();
  renderCustomFields();
  renderColorImageFields([]);
  updateTagHiddenInput(categoryHiddenInput, selectedCategories);
  updateTagHiddenInput(homeSectionsHiddenInput, selectedHomeSections);
  renderTagList(categoryTags, selectedCategories, () => {});
  renderTagList(homeSectionTags, selectedHomeSections, () => {});
  updateProductSizeEstimate();
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

const loadCategories = async () => {
  if (!window.gtSupabase1 || !categorySelect) return;
  const { data } = await window.gtSupabase1
    .from("categories")
    .select("name, slug")
    .neq("is_active", false)
    .order("name", { ascending: true });
  categoriesCache = data || [];
  categorySelect.innerHTML = "<option value=\"\">Select category</option>";
  categoriesCache.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.slug || category.name || "";
    option.textContent = category.name || category.slug || "Category";
    categorySelect.appendChild(option);
  });
};

const renderProducts = (products) => {
  productTableBody.innerHTML = "";
  products.forEach((product) => {
    const stockQuantity = Number(product.stock_quantity || 0);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${product.title || ""}</td>
      <td>${product.category || ""}</td>
      <td>${stockQuantity}</td>
      <td><span class="badge">${product.is_active ? "Active" : "Inactive"}</span></td>
      <td>
        <div class="actions-row">
          <button class="btn secondary" data-edit="${product.id}">Edit</button>
          <button class="btn secondary" data-toggle-active="${product.id}" data-next-active="${product.is_active ? "false" : "true"}">${product.is_active ? "Deactivate" : "Activate"}</button>
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

  productTableBody.querySelectorAll("[data-toggle-active]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-toggle-active");
      const nextActive = btn.getAttribute("data-next-active") === "true";
      const { error } = await window.gtSupabase1
        .from("products")
        .update({
          is_active: nextActive,
          stock_updated_at: new Date().toISOString()
        })
        .eq("id", id);
      if (error) {
        setStatus(error.message);
        return;
      }
      setStatus(nextActive ? "Product activated." : "Product deactivated.");
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
  selectedCategories = normalizeList(product.category);
  updateTagHiddenInput(categoryHiddenInput, selectedCategories);
  document.querySelector("#price").value = product.price || "";
  document.querySelector("#old_price").value = product.old_price || "";
  document.querySelector("#rating").value = product.rating || "";
  document.querySelector("#badge").value = product.badge || "";
  document.querySelector("#short_desc").value = product.short_desc || "";
  document.querySelector("#description").value = product.description || "";
  document.querySelector("#stock").value = product.stock || "";
  document.querySelector("#stock_quantity").value = Number(product.stock_quantity || 0);
  document.querySelector("#colors").value = normalizeList(product.colors).join(", ");
  selectedHomeSections = normalizeList(product.home_sections);
  updateTagHiddenInput(homeSectionsHiddenInput, selectedHomeSections);
  document.querySelector("#is_active").checked = product.is_active !== false;

  mainImageUrl = (product.images || [])[0] || "";
  galleryUrls = normalizeList(product.gallery).filter((url) => url && url !== mainImageUrl);
  customFields = normalizeSpecs(product.specs);
  colorImageMap = normalizeColorImages(product.color_images);
  mediaSizeBytes = { main: 0, gallery: [], colors: {} };
  renderImageList();
  renderCustomFields();
  renderColorImageFields(parseList(document.querySelector("#colors").value));
  renderTagList(categoryTags, selectedCategories, (index) => {
    selectedCategories.splice(index, 1);
    updateTagHiddenInput(categoryHiddenInput, selectedCategories);
    renderTagList(categoryTags, selectedCategories, () => {});
  });
  renderTagList(homeSectionTags, selectedHomeSections, (index) => {
    selectedHomeSections.splice(index, 1);
    updateTagHiddenInput(homeSectionsHiddenInput, selectedHomeSections);
    renderTagList(homeSectionTags, selectedHomeSections, () => {});
  });
  updateProductSizeEstimate();
};

if (mainImageInput) {
  mainImageInput.addEventListener("change", async () => {
    if (!mainImageInput.files?.length) return;
    if (!isAllowedImage(mainImageInput.files[0])) {
      setMainStatus("Only PNG, JPG/JPEG, or WEBP images are allowed.");
      return;
    }
    const slug = document.querySelector("#slug").value.trim() || "product";
    setMainStatus("Crop and upload main image...");
    const preparedFile = await prepareImageForUpload(mainImageInput.files[0], "showcase");
    if (!preparedFile) {
      setMainStatus("Image crop canceled.");
      mainImageInput.value = "";
      return;
    }
    const upload = await uploadToStorage(preparedFile, slug);
    if (upload.url) {
      mainImageUrl = upload.url;
      mediaSizeBytes.main = upload.size;
      setMainStatus("Main image uploaded.");
      window.showToast?.("Main image uploaded");
    }
    mainImageInput.value = "";
    renderImageList();
    updateProductSizeEstimate();
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
    const files = allFiles.slice(0, MAX_GALLERY_IMAGES - galleryUrls.length);
    if (!files.length) {
      setGalleryStatus(`Gallery limit reached (${MAX_GALLERY_IMAGES} gallery images, ${MAX_TOTAL_IMAGES} total including main). Remove one to add more.`);
      return;
    }
    setGalleryStatus("Crop and upload gallery images...");
    for (const file of files) {
      const preparedFile = await prepareImageForUpload(file, "card");
      if (!preparedFile) continue;
      const upload = await uploadToStorage(preparedFile, slug);
      if (upload.url) {
        galleryUrls.push(upload.url);
        mediaSizeBytes.gallery.push(upload.size);
      }
    }
    setGalleryStatus("Gallery updated.");
    window.showToast?.("Gallery updated");
    galleryInput.value = "";
    renderImageList();
    updateProductSizeEstimate();
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
    mediaSizeBytes.colors = Object.fromEntries(
      Object.entries(mediaSizeBytes.colors).filter(([color]) => nextMap[color])
    );
    renderColorImageFields(list);
    renderImageList();
    updateProductSizeEstimate();
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

if (addCategoryTagBtn && categorySelect) {
  addCategoryTagBtn.addEventListener("click", () => {
    addCategoryTag(categorySelect.value);
    categorySelect.value = "";
  });
}

if (addSectionTagBtn && homeSectionsSelect) {
  addSectionTagBtn.addEventListener("click", () => {
    addHomeSectionTag(homeSectionsSelect.value);
    homeSectionsSelect.value = "";
  });
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
      category: categoryHiddenInput?.value.trim() || "",
      price: Number(document.querySelector("#price").value || 0),
      old_price: Number(document.querySelector("#old_price").value || 0),
      rating: Number(document.querySelector("#rating").value || 0),
      badge: document.querySelector("#badge").value.trim(),
      short_desc: document.querySelector("#short_desc").value.trim(),
      description: document.querySelector("#description").value.trim(),
      stock: document.querySelector("#stock").value.trim(),
      stock_quantity: Math.max(0, Number(document.querySelector("#stock_quantity").value || 0)),
      stock_updated_at: new Date().toISOString(),
      images: mainImageUrl ? [mainImageUrl] : [],
      gallery: galleryUrls.filter((url) => url && url !== mainImageUrl),
      colors: parseList(document.querySelector("#colors").value),
      home_sections: parseList(homeSectionsHiddenInput?.value || ""),
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

if (cropperZoom) {
  cropperZoom.addEventListener("input", () => {
    setCropperZoom(Number(cropperZoom.value || 1));
  });
}

cropperRatioButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!cropperSession) return;
    cropperSession.ratioKey = button.getAttribute("data-crop-ratio") || "showcase";
    applyCropLayout();
    resetCropperView();
  });
});

if (cropperStage) {
  cropperStage.addEventListener("pointerdown", (event) => {
    if (!cropperSession) return;
    cropperSession.dragPointerId = event.pointerId;
    cropperSession.dragStartX = event.clientX;
    cropperSession.dragStartY = event.clientY;
    cropperSession.startOffsetX = cropperSession.offsetX;
    cropperSession.startOffsetY = cropperSession.offsetY;
    cropperStage.classList.add("is-dragging");
    cropperStage.setPointerCapture?.(event.pointerId);
  });

  cropperStage.addEventListener("pointermove", (event) => {
    if (!cropperSession || cropperSession.dragPointerId !== event.pointerId) return;
    cropperSession.offsetX = cropperSession.startOffsetX + (event.clientX - cropperSession.dragStartX);
    cropperSession.offsetY = cropperSession.startOffsetY + (event.clientY - cropperSession.dragStartY);
    clampCropperOffsets();
  });

  const endCropDrag = (event) => {
    if (!cropperSession || cropperSession.dragPointerId !== event.pointerId) return;
    cropperSession.dragPointerId = null;
    cropperStage.classList.remove("is-dragging");
    cropperStage.releasePointerCapture?.(event.pointerId);
  };

  cropperStage.addEventListener("pointerup", endCropDrag);
  cropperStage.addEventListener("pointercancel", endCropDrag);
  cropperStage.addEventListener("wheel", (event) => {
    if (!cropperSession) return;
    event.preventDefault();
    const stageRect = cropperStage.getBoundingClientRect();
    const anchorX = event.clientX - stageRect.left;
    const anchorY = event.clientY - stageRect.top;
    const nextZoom = Number(cropperZoom?.value || cropperSession.zoom) + (event.deltaY < 0 ? 0.08 : -0.08);
    if (cropperZoom) cropperZoom.value = String(clamp(nextZoom, 1, 3));
    setCropperZoom(nextZoom, anchorX, anchorY);
  }, { passive: false });
}

if (cropperApplyBtn) {
  cropperApplyBtn.addEventListener("click", async () => {
    if (!cropperSession) return;
    const resolver = cropperSession.resolve;
    const croppedFile = await exportCroppedFile();
    closeCropper();
    resolver(croppedFile);
  });
}

if (cropperResetBtn) {
  cropperResetBtn.addEventListener("click", () => {
    if (!cropperSession) return;
    applyCropLayout();
    resetCropperView();
  });
}

[cropperCancelBtn, cropperCancelTopBtn].forEach((button) => {
  if (!button) return;
  button.addEventListener("click", () => {
    if (!cropperSession) return;
    const resolver = cropperSession.resolve;
    closeCropper();
    resolver(null);
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !cropperSession) return;
  const resolver = cropperSession.resolve;
  closeCropper();
  resolver(null);
});

renderImageList();
renderCustomFields();
renderColorImageFields(parseList(colorsInput?.value || ""));
renderTagList(categoryTags, selectedCategories, (index) => {
  selectedCategories.splice(index, 1);
  updateTagHiddenInput(categoryHiddenInput, selectedCategories);
  renderTagList(categoryTags, selectedCategories, () => {});
});
renderTagList(homeSectionTags, selectedHomeSections, (index) => {
  selectedHomeSections.splice(index, 1);
  updateTagHiddenInput(homeSectionsHiddenInput, selectedHomeSections);
  renderTagList(homeSectionTags, selectedHomeSections, () => {});
});
loadCategories();
loadProducts();
updateProductSizeEstimate();

if (productForm) {
  productForm.querySelectorAll("input, textarea, select").forEach((field) => {
    field.addEventListener("input", updateProductSizeEstimate);
    field.addEventListener("change", updateProductSizeEstimate);
  });
}
