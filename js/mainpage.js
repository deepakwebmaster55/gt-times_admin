const heroTableBody = document.querySelector("#hero-table tbody");
const heroForm = document.querySelector("#hero-form");
const heroReset = document.querySelector("#hero-reset");
const heroPositionReset = document.querySelector("#hero-position-reset");
const heroStatus = document.querySelector("#hero-status");
const heroCount = document.querySelector("#hero-count");
const sectionTableBody = document.querySelector("#section-table tbody");
const sectionStatus = document.querySelector("#section-status");

const heroImageInput = document.querySelector("#hero-image");
const heroMobileImageInput = document.querySelector("#hero-mobile-image");
const heroSvgInput = document.querySelector("#hero-svg");

const heroImageStatus = document.querySelector("#hero-image-status");
const heroMobileImageStatus = document.querySelector("#hero-mobile-image-status");
const heroSvgStatus = document.querySelector("#hero-svg-status");

const heroImagePreview = document.querySelector("#hero-image-preview");
const heroMobileImagePreview = document.querySelector("#hero-mobile-image-preview");
const heroSvgPreview = document.querySelector("#hero-svg-preview");

const heroDesktopCanvas = document.querySelector("#hero-desktop-canvas");
const heroMobileCanvas = document.querySelector("#hero-mobile-canvas");
const heroDesktopBg = document.querySelector("#hero-desktop-bg");
const heroMobileBg = document.querySelector("#hero-mobile-bg");
const heroDesktopSvgHandle = document.querySelector("#hero-desktop-svg-handle");
const heroMobileSvgHandle = document.querySelector("#hero-mobile-svg-handle");
const heroDesktopSvgImage = document.querySelector("#hero-desktop-svg-image");
const heroMobileSvgImage = document.querySelector("#hero-mobile-svg-image");
const heroDesktopReadout = document.querySelector("#hero-desktop-position-readout");
const heroMobileReadout = document.querySelector("#hero-mobile-position-readout");
const heroCropperModal = document.querySelector("#hero-image-cropper-modal");
const heroCropperStage = document.querySelector("#hero-cropper-stage");
const heroCropperImage = document.querySelector("#hero-cropper-image");
const heroCropperZoom = document.querySelector("#hero-cropper-zoom");
const heroCropperApplyBtn = document.querySelector("#hero-cropper-apply");
const heroCropperCancelBtn = document.querySelector("#hero-cropper-cancel");
const heroCropperCancelTopBtn = document.querySelector("#hero-cropper-cancel-top");
const heroCropperResetBtn = document.querySelector("#hero-cropper-reset");
const heroCropperRatioButtons = Array.from(document.querySelectorAll("[data-hero-crop-ratio]"));

const desktopXInput = document.querySelector("#hero-svg-desktop-x");
const desktopYInput = document.querySelector("#hero-svg-desktop-y");
const mobileXInput = document.querySelector("#hero-svg-mobile-x");
const mobileYInput = document.querySelector("#hero-svg-mobile-y");

const STORAGE_BUCKET = "product-images";
const HERO_TABLE = "home_sliders";
const HERO_LIMIT = 5;
const DEFAULT_POSITIONS = {
  desktop: { x: 74, y: 50 },
  mobile: { x: 50, y: 26 }
};
const HERO_CROP_PRESETS = {
  hero_desktop: { label: "Desktop 1920 x 1080", ratio: 16 / 9 },
  hero_mobile: { label: "Mobile 1080 x 1350", ratio: 4 / 5 }
};

let heroDesktopImageUrl = "";
let heroMobileImageUrl = "";
let heroSvgUrl = "";
let heroSlidesCache = [];
let activeDragDevice = null;
let heroCropperSession = null;

const setHeroStatus = (message) => {
  if (heroStatus) heroStatus.textContent = message;
};

const setSectionStatus = (message) => {
  if (sectionStatus) sectionStatus.textContent = message;
};

const setUploadStatus = (target, message) => {
  if (target) target.textContent = message;
};

const sanitizeFileName = (name) => name.replace(/[^a-z0-9._-]/gi, "_");

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parsePercent = (value, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return clamp(Math.round(number * 100) / 100, 0, 100);
};

const getPositionState = (device) => {
  if (device === "mobile") {
    return {
      x: parsePercent(mobileXInput?.value, DEFAULT_POSITIONS.mobile.x),
      y: parsePercent(mobileYInput?.value, DEFAULT_POSITIONS.mobile.y)
    };
  }
  return {
    x: parsePercent(desktopXInput?.value, DEFAULT_POSITIONS.desktop.x),
    y: parsePercent(desktopYInput?.value, DEFAULT_POSITIONS.desktop.y)
  };
};

const setPositionState = (device, x, y) => {
  const nextX = parsePercent(x, DEFAULT_POSITIONS[device].x);
  const nextY = parsePercent(y, DEFAULT_POSITIONS[device].y);
  if (device === "mobile") {
    if (mobileXInput) mobileXInput.value = String(nextX);
    if (mobileYInput) mobileYInput.value = String(nextY);
  } else {
    if (desktopXInput) desktopXInput.value = String(nextX);
    if (desktopYInput) desktopYInput.value = String(nextY);
  }
};

const setCanvasPosition = (canvas, x, y) => {
  if (!canvas) return;
  canvas.style.setProperty("--svg-x", `${x}%`);
  canvas.style.setProperty("--svg-y", `${y}%`);
};

const updatePositionReadout = (device, x, y) => {
  const target = device === "mobile" ? heroMobileReadout : heroDesktopReadout;
  if (target) target.textContent = `X ${x}% | Y ${y}%`;
};

const renderAssetPreview = (target, label, url) => {
  if (!target) return;
  if (!url) {
    target.textContent = `No ${label.toLowerCase()} uploaded yet.`;
    return;
  }
  target.innerHTML = `Current ${escapeHtml(label.toLowerCase())}: <a href="${url}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`;
};

const applyPreviewImages = () => {
  if (heroDesktopBg) heroDesktopBg.style.backgroundImage = heroDesktopImageUrl ? `url("${heroDesktopImageUrl}")` : "none";
  if (heroMobileBg) heroMobileBg.style.backgroundImage = (heroMobileImageUrl || heroDesktopImageUrl)
    ? `url("${heroMobileImageUrl || heroDesktopImageUrl}")`
    : "none";
  const showSvg = !!heroSvgUrl;
  [heroDesktopSvgImage, heroMobileSvgImage].forEach((img) => {
    if (!img) return;
    img.src = heroSvgUrl || "";
    img.style.display = showSvg ? "block" : "none";
  });
  [heroDesktopSvgHandle, heroMobileSvgHandle].forEach((handle) => {
    if (!handle) return;
    handle.classList.toggle("is-empty", !showSvg);
  });
};

const renderPositionPreviews = () => {
  const desktop = getPositionState("desktop");
  const mobile = getPositionState("mobile");
  setCanvasPosition(heroDesktopCanvas, desktop.x, desktop.y);
  setCanvasPosition(heroMobileCanvas, mobile.x, mobile.y);
  updatePositionReadout("desktop", desktop.x, desktop.y);
  updatePositionReadout("mobile", mobile.x, mobile.y);
};

const renderHeroPreviews = () => {
  renderAssetPreview(heroImagePreview, "Desktop image", heroDesktopImageUrl);
  renderAssetPreview(heroMobileImagePreview, "Mobile image", heroMobileImageUrl);
  renderAssetPreview(heroSvgPreview, "SVG overlay", heroSvgUrl);
  applyPreviewImages();
  renderPositionPreviews();
};

const resetPositionState = () => {
  setPositionState("desktop", DEFAULT_POSITIONS.desktop.x, DEFAULT_POSITIONS.desktop.y);
  setPositionState("mobile", DEFAULT_POSITIONS.mobile.x, DEFAULT_POSITIONS.mobile.y);
  renderPositionPreviews();
};

const normalizeSectionList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
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
    if (trimmed.includes(",")) {
      return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return [trimmed];
  }
  return [];
};

const isAllowedImage = (file) => {
  if (!file) return false;
  const type = (file.type || "").toLowerCase();
  if (type === "image/png" || type === "image/jpeg" || type === "image/webp") return true;
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp");
};

const getHeroCropPreset = (key) => HERO_CROP_PRESETS[key] || HERO_CROP_PRESETS.hero_desktop;

const renderHeroCropRatioButtons = (activeKey) => {
  heroCropperRatioButtons.forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-hero-crop-ratio") === activeKey);
  });
};

const applyHeroCropLayout = () => {
  if (!heroCropperSession || !heroCropperStage) return;
  const preset = getHeroCropPreset(heroCropperSession.ratioKey);
  heroCropperStage.style.aspectRatio = String(preset.ratio);
};

const updateHeroCropTransform = () => {
  if (!heroCropperSession || !heroCropperImage) return;
  heroCropperImage.style.width = `${heroCropperSession.displayWidth}px`;
  heroCropperImage.style.height = `${heroCropperSession.displayHeight}px`;
  heroCropperImage.style.transform = `translate(${heroCropperSession.offsetX}px, ${heroCropperSession.offsetY}px)`;
};

const clampHeroCropOffsets = () => {
  if (!heroCropperSession || !heroCropperStage) return;
  const stageRect = heroCropperStage.getBoundingClientRect();
  heroCropperSession.stageWidth = stageRect.width;
  heroCropperSession.stageHeight = stageRect.height;
  const minX = Math.min(0, heroCropperSession.stageWidth - heroCropperSession.displayWidth);
  const minY = Math.min(0, heroCropperSession.stageHeight - heroCropperSession.displayHeight);
  heroCropperSession.offsetX = clamp(heroCropperSession.offsetX, minX, 0);
  heroCropperSession.offsetY = clamp(heroCropperSession.offsetY, minY, 0);
  updateHeroCropTransform();
};

const resetHeroCropperView = () => {
  if (!heroCropperSession || !heroCropperStage) return;
  const preset = getHeroCropPreset(heroCropperSession.ratioKey);
  const stageRect = heroCropperStage.getBoundingClientRect();
  const stageWidth = stageRect.width || 700;
  const stageHeight = stageRect.height || Math.round(stageWidth / preset.ratio);
  const baseScale = Math.max(stageWidth / heroCropperSession.image.naturalWidth, stageHeight / heroCropperSession.image.naturalHeight);
  heroCropperSession.baseWidth = heroCropperSession.image.naturalWidth * baseScale;
  heroCropperSession.baseHeight = heroCropperSession.image.naturalHeight * baseScale;
  heroCropperSession.displayWidth = heroCropperSession.baseWidth;
  heroCropperSession.displayHeight = heroCropperSession.baseHeight;
  heroCropperSession.zoom = 1;
  heroCropperSession.stageWidth = stageWidth;
  heroCropperSession.stageHeight = stageHeight;
  heroCropperSession.offsetX = (stageWidth - heroCropperSession.displayWidth) / 2;
  heroCropperSession.offsetY = (stageHeight - heroCropperSession.displayHeight) / 2;
  if (heroCropperZoom) heroCropperZoom.value = "1";
  renderHeroCropRatioButtons(heroCropperSession.ratioKey);
  clampHeroCropOffsets();
};

const closeHeroCropper = () => {
  if (!heroCropperSession) return;
  if (heroCropperSession.objectUrl) URL.revokeObjectURL(heroCropperSession.objectUrl);
  heroCropperSession = null;
  if (heroCropperModal) {
    heroCropperModal.classList.add("hidden");
    heroCropperModal.setAttribute("aria-hidden", "true");
  }
  if (heroCropperImage) {
    heroCropperImage.removeAttribute("src");
    heroCropperImage.style.transform = "";
    heroCropperImage.style.width = "";
    heroCropperImage.style.height = "";
  }
  if (heroCropperZoom) heroCropperZoom.value = "1";
  heroCropperStage?.classList.remove("is-dragging");
};

const setHeroCropZoom = (nextZoom, anchorX, anchorY) => {
  if (!heroCropperSession || !heroCropperStage) return;
  const stageRect = heroCropperStage.getBoundingClientRect();
  const pointerX = Number.isFinite(anchorX) ? anchorX : stageRect.width / 2;
  const pointerY = Number.isFinite(anchorY) ? anchorY : stageRect.height / 2;
  const prevWidth = heroCropperSession.displayWidth;
  const prevHeight = heroCropperSession.displayHeight;
  const ratioX = prevWidth ? (pointerX - heroCropperSession.offsetX) / prevWidth : 0.5;
  const ratioY = prevHeight ? (pointerY - heroCropperSession.offsetY) / prevHeight : 0.5;
  heroCropperSession.zoom = clamp(nextZoom, 1, 3);
  heroCropperSession.displayWidth = heroCropperSession.baseWidth * heroCropperSession.zoom;
  heroCropperSession.displayHeight = heroCropperSession.baseHeight * heroCropperSession.zoom;
  heroCropperSession.offsetX = pointerX - (heroCropperSession.displayWidth * ratioX);
  heroCropperSession.offsetY = pointerY - (heroCropperSession.displayHeight * ratioY);
  clampHeroCropOffsets();
};

const exportHeroCroppedFile = async () => {
  if (!heroCropperSession) return null;
  const { image, offsetX, offsetY, displayWidth, displayHeight, stageWidth, stageHeight, file } = heroCropperSession;
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

const openHeroCropper = (file, ratioKey = "hero_desktop") => new Promise((resolve) => {
  if (!heroCropperModal || !heroCropperStage || !heroCropperImage || !heroCropperZoom) {
    resolve(file);
    return;
  }
  const objectUrl = URL.createObjectURL(file);
  const previewImage = new Image();
  previewImage.onload = () => {
    heroCropperModal.classList.remove("hidden");
    heroCropperModal.setAttribute("aria-hidden", "false");
    heroCropperSession = {
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
    applyHeroCropLayout();
    heroCropperImage.src = objectUrl;
    resetHeroCropperView();
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
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
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
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) return null;
  return new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: "image/webp" });
};

const prepareHeroImageForUpload = async (file, ratioKey) => {
  const croppedFile = await openHeroCropper(file, ratioKey);
  if (!croppedFile) return null;
  if (croppedFile.type === "image/webp") return croppedFile;
  return fileToWebp(croppedFile);
};

const uploadToStorage = async (file, slug, kind) => {
  if (!window.gtSupabase1) return "";
  const fileName = sanitizeFileName(file.name);
  const path = `hero/${sanitizeFileName(slug || "slide")}/${kind}/${Date.now()}_${fileName}`;
  const { error } = await window.gtSupabase1.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || undefined
  });
  if (error) {
    setHeroStatus(error.message);
    return "";
  }
  const { data } = window.gtSupabase1.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
};

const updateHeroCount = () => {
  if (heroCount) heroCount.textContent = String(heroSlidesCache.length);
};

const clearHeroForm = () => {
  if (!heroForm) return;
  heroForm.reset();
  document.querySelector("#hero-id").value = "";
  document.querySelector("#hero-active").checked = true;
  document.querySelector("#hero-order").value = "0";
  heroDesktopImageUrl = "";
  heroMobileImageUrl = "";
  heroSvgUrl = "";
  if (heroImageInput) heroImageInput.value = "";
  if (heroMobileImageInput) heroMobileImageInput.value = "";
  if (heroSvgInput) heroSvgInput.value = "";
  setUploadStatus(heroImageStatus, "");
  setUploadStatus(heroMobileImageStatus, "");
  setUploadStatus(heroSvgStatus, "");
  resetPositionState();
  renderHeroPreviews();
};

const loadHeroSlides = async () => {
  window.setAdminLoading?.(true);
  window.renderSkeletonRows?.(heroTableBody, 4, 4);
  try {
    if (!window.gtSupabase1) {
      setHeroStatus("Supabase 1 keys missing in admin/js/config.js");
      return;
    }
    const { data, error } = await window.gtSupabase1
      .from(HERO_TABLE)
      .select("*")
      .order("order_index", { ascending: true });

    if (error) {
      setHeroStatus(error.message);
      return;
    }

    heroSlidesCache = data || [];
    updateHeroCount();
    heroTableBody.innerHTML = "";

    heroSlidesCache.forEach((slide) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(slide.title || "")}</td>
        <td>${slide.order_index ?? 0}</td>
        <td><span class="badge">${slide.is_active ? "Active" : "Inactive"}</span></td>
        <td>
          <div class="actions-row">
            <button class="btn secondary" type="button" data-hero-edit="${slide.id}">Edit</button>
            <button class="btn link" type="button" data-hero-delete="${slide.id}">Delete</button>
          </div>
        </td>
      `;
      heroTableBody.appendChild(row);
    });

    heroTableBody.querySelectorAll("[data-hero-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-hero-edit");
        const data = heroSlidesCache.find((slide) => String(slide.id) === String(id));
        if (!data) return;
        document.querySelector("#hero-id").value = data.id || "";
        document.querySelector("#hero-eyebrow").value = data.eyebrow || "";
        document.querySelector("#hero-title").value = data.title || "";
        document.querySelector("#hero-subtitle").value = data.subtitle || "";
        document.querySelector("#hero-primary-label").value = data.primary_cta_label || "";
        document.querySelector("#hero-primary-link").value = data.primary_cta_link || "";
        document.querySelector("#hero-secondary-label").value = data.secondary_cta_label || "";
        document.querySelector("#hero-secondary-link").value = data.secondary_cta_link || "";
        document.querySelector("#hero-order").value = data.order_index ?? 0;
        document.querySelector("#hero-active").checked = data.is_active !== false;
        heroDesktopImageUrl = data.image_url || "";
        heroMobileImageUrl = data.mobile_image_url || data.image_url || "";
        heroSvgUrl = data.overlay_svg_url || data.svg_url || "";
        setPositionState("desktop", data.svg_desktop_x ?? DEFAULT_POSITIONS.desktop.x, data.svg_desktop_y ?? DEFAULT_POSITIONS.desktop.y);
        setPositionState("mobile", data.svg_mobile_x ?? DEFAULT_POSITIONS.mobile.x, data.svg_mobile_y ?? DEFAULT_POSITIONS.mobile.y);
        renderHeroPreviews();
        setHeroStatus("Loaded slide for editing.");
      });
    });

    heroTableBody.querySelectorAll("[data-hero-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-hero-delete");
        if (!confirm("Delete this slide?")) return;
        const { error } = await window.gtSupabase1.from(HERO_TABLE).delete().eq("id", id);
        if (error) {
          setHeroStatus(error.message);
          return;
        }
        window.showToast?.("Slide deleted.");
        loadHeroSlides();
      });
    });
  } finally {
    window.setAdminLoading?.(false);
  }
};

const bindUploadInput = (input, statusEl, updater, kind, successMessage) => {
  if (!input) return;
  input.addEventListener("change", async () => {
    if (!input.files?.length) return;
    if (kind !== "svg" && !isAllowedImage(input.files[0])) {
      setUploadStatus(statusEl, "Only PNG, JPG/JPEG, or WEBP images are allowed.");
      return;
    }
    const slug = document.querySelector("#hero-title").value.trim() || "hero";
    setUploadStatus(statusEl, kind === "svg" ? "Uploading svg..." : `Crop and upload ${kind} image...`);
    const preparedFile = kind === "svg"
      ? input.files[0]
      : await prepareHeroImageForUpload(input.files[0], kind === "mobile" ? "hero_mobile" : "hero_desktop");
    if (!preparedFile) {
      setUploadStatus(statusEl, kind === "svg" ? "" : "Image crop canceled.");
      input.value = "";
      return;
    }
    const url = await uploadToStorage(preparedFile, slug, kind);
    if (!url) return;
    updater(url);
    setUploadStatus(statusEl, successMessage);
    renderHeroPreviews();
    window.showToast?.(successMessage);
    input.value = "";
  });
};

const updatePositionFromPointer = (device, clientX, clientY) => {
  const canvas = device === "mobile" ? heroMobileCanvas : heroDesktopCanvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;
  setPositionState(device, x, y);
  renderPositionPreviews();
};

const beginDrag = (device, event) => {
  if (!heroSvgUrl) return;
  activeDragDevice = device;
  event.preventDefault();
  const point = event.touches?.[0] || event;
  updatePositionFromPointer(device, point.clientX, point.clientY);
};

const moveDrag = (event) => {
  if (!activeDragDevice) return;
  const point = event.touches?.[0] || event;
  updatePositionFromPointer(activeDragDevice, point.clientX, point.clientY);
};

const endDrag = () => {
  activeDragDevice = null;
};

bindUploadInput(heroImageInput, heroImageStatus, (url) => {
  heroDesktopImageUrl = url;
}, "desktop", "Desktop image uploaded.");

bindUploadInput(heroMobileImageInput, heroMobileImageStatus, (url) => {
  heroMobileImageUrl = url;
}, "mobile", "Mobile image uploaded.");

bindUploadInput(heroSvgInput, heroSvgStatus, (url) => {
  heroSvgUrl = url;
}, "svg", "SVG overlay uploaded.");

if (heroCropperZoom) {
  heroCropperZoom.addEventListener("input", () => {
    setHeroCropZoom(Number(heroCropperZoom.value || 1));
  });
}

heroCropperRatioButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!heroCropperSession) return;
    heroCropperSession.ratioKey = button.getAttribute("data-hero-crop-ratio") || "hero_desktop";
    applyHeroCropLayout();
    resetHeroCropperView();
  });
});

if (heroCropperStage) {
  heroCropperStage.addEventListener("pointerdown", (event) => {
    if (!heroCropperSession) return;
    heroCropperSession.dragPointerId = event.pointerId;
    heroCropperSession.dragStartX = event.clientX;
    heroCropperSession.dragStartY = event.clientY;
    heroCropperSession.startOffsetX = heroCropperSession.offsetX;
    heroCropperSession.startOffsetY = heroCropperSession.offsetY;
    heroCropperStage.classList.add("is-dragging");
    heroCropperStage.setPointerCapture?.(event.pointerId);
  });

  heroCropperStage.addEventListener("pointermove", (event) => {
    if (!heroCropperSession || heroCropperSession.dragPointerId !== event.pointerId) return;
    heroCropperSession.offsetX = heroCropperSession.startOffsetX + (event.clientX - heroCropperSession.dragStartX);
    heroCropperSession.offsetY = heroCropperSession.startOffsetY + (event.clientY - heroCropperSession.dragStartY);
    clampHeroCropOffsets();
  });

  const endHeroCropDrag = (event) => {
    if (!heroCropperSession || heroCropperSession.dragPointerId !== event.pointerId) return;
    heroCropperSession.dragPointerId = null;
    heroCropperStage.classList.remove("is-dragging");
    heroCropperStage.releasePointerCapture?.(event.pointerId);
  };

  heroCropperStage.addEventListener("pointerup", endHeroCropDrag);
  heroCropperStage.addEventListener("pointercancel", endHeroCropDrag);
  heroCropperStage.addEventListener("wheel", (event) => {
    if (!heroCropperSession) return;
    event.preventDefault();
    const stageRect = heroCropperStage.getBoundingClientRect();
    const anchorX = event.clientX - stageRect.left;
    const anchorY = event.clientY - stageRect.top;
    const nextZoom = Number(heroCropperZoom?.value || heroCropperSession.zoom) + (event.deltaY < 0 ? 0.08 : -0.08);
    if (heroCropperZoom) heroCropperZoom.value = String(clamp(nextZoom, 1, 3));
    setHeroCropZoom(nextZoom, anchorX, anchorY);
  }, { passive: false });
}

if (heroCropperApplyBtn) {
  heroCropperApplyBtn.addEventListener("click", async () => {
    if (!heroCropperSession) return;
    const resolver = heroCropperSession.resolve;
    const croppedFile = await exportHeroCroppedFile();
    closeHeroCropper();
    resolver(croppedFile);
  });
}

if (heroCropperResetBtn) {
  heroCropperResetBtn.addEventListener("click", () => {
    if (!heroCropperSession) return;
    applyHeroCropLayout();
    resetHeroCropperView();
  });
}

[heroCropperCancelBtn, heroCropperCancelTopBtn].forEach((button) => {
  if (!button) return;
  button.addEventListener("click", () => {
    if (!heroCropperSession) return;
    const resolver = heroCropperSession.resolve;
    closeHeroCropper();
    resolver(null);
  });
});

[heroDesktopSvgHandle, heroMobileSvgHandle].forEach((handle) => {
  if (!handle) return;
  const device = handle.getAttribute("data-device") || "desktop";
  handle.addEventListener("mousedown", (event) => beginDrag(device, event));
  handle.addEventListener("touchstart", (event) => beginDrag(device, event), { passive: false });
});

[heroDesktopCanvas, heroMobileCanvas].forEach((canvas) => {
  if (!canvas) return;
  const device = canvas.getAttribute("data-device") || "desktop";
  canvas.addEventListener("mousedown", (event) => beginDrag(device, event));
  canvas.addEventListener("touchstart", (event) => beginDrag(device, event), { passive: false });
});

document.addEventListener("mousemove", moveDrag);
document.addEventListener("touchmove", moveDrag, { passive: false });
document.addEventListener("mouseup", endDrag);
document.addEventListener("touchend", endDrag);
document.addEventListener("touchcancel", endDrag);
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !heroCropperSession) return;
  const resolver = heroCropperSession.resolve;
  closeHeroCropper();
  resolver(null);
});

if (heroPositionReset) {
  heroPositionReset.addEventListener("click", () => {
    resetPositionState();
    window.showToast?.("SVG positions reset.");
  });
}

if (heroForm) {
  heroForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!window.gtSupabase1) {
      setHeroStatus("Supabase 1 keys missing in admin/js/config.js");
      return;
    }

    const heroId = document.querySelector("#hero-id").value || undefined;
    if (!heroId && heroSlidesCache.length >= HERO_LIMIT) {
      setHeroStatus(`You can add only ${HERO_LIMIT} hero slides.`);
      return;
    }

    const desktopPosition = getPositionState("desktop");
    const mobilePosition = getPositionState("mobile");

    const payload = {
      id: heroId,
      eyebrow: document.querySelector("#hero-eyebrow").value.trim(),
      title: document.querySelector("#hero-title").value.trim(),
      subtitle: document.querySelector("#hero-subtitle").value.trim(),
      image_url: heroDesktopImageUrl,
      mobile_image_url: heroMobileImageUrl || heroDesktopImageUrl,
      overlay_svg_url: heroSvgUrl,
      svg_desktop_x: desktopPosition.x,
      svg_desktop_y: desktopPosition.y,
      svg_mobile_x: mobilePosition.x,
      svg_mobile_y: mobilePosition.y,
      primary_cta_label: document.querySelector("#hero-primary-label").value.trim(),
      primary_cta_link: document.querySelector("#hero-primary-link").value.trim(),
      secondary_cta_label: document.querySelector("#hero-secondary-label").value.trim(),
      secondary_cta_link: document.querySelector("#hero-secondary-link").value.trim(),
      order_index: Number(document.querySelector("#hero-order").value || 0),
      is_active: document.querySelector("#hero-active").checked
    };

    if (!payload.title || !payload.image_url) {
      setHeroStatus("Title and desktop image are required.");
      return;
    }

    const { error } = await window.gtSupabase1.from(HERO_TABLE).upsert(payload);
    if (error) {
      setHeroStatus(error.message);
      return;
    }

    setHeroStatus("Slide saved.");
    window.showToast?.("Slide saved.");
    clearHeroForm();
    loadHeroSlides();
  });
}

if (heroReset) {
  heroReset.addEventListener("click", clearHeroForm);
}

const toggleSection = async (productId, sectionKey, enabled) => {
  if (!window.gtSupabase1) {
    setSectionStatus("Supabase 1 keys missing in admin/js/config.js");
    return;
  }
  const { data, error } = await window.gtSupabase1
    .from("products")
    .select("home_sections")
    .eq("id", productId)
    .single();
  if (error) {
    setSectionStatus(error.message);
    return;
  }
  const sections = normalizeSectionList(data.home_sections);
  const nextSections = enabled
    ? Array.from(new Set([...sections, sectionKey]))
    : sections.filter((item) => item !== sectionKey);

  const { error: updateError } = await window.gtSupabase1
    .from("products")
    .update({ home_sections: nextSections })
    .eq("id", productId);

  if (updateError) {
    setSectionStatus(updateError.message);
    return;
  }
  setSectionStatus("Sections updated.");
  window.showToast?.("Sections updated.");
};

const loadSectionTable = async () => {
  window.renderSkeletonRows?.(sectionTableBody, 6, 4);
  if (!window.gtSupabase1) {
    setSectionStatus("Supabase 1 keys missing in admin/js/config.js");
    return;
  }
  const { data, error } = await window.gtSupabase1
    .from("products")
    .select("id, title, home_sections")
    .order("created_at", { ascending: false });

  if (error) {
    setSectionStatus(error.message);
    return;
  }

  sectionTableBody.innerHTML = "";
  (data || []).forEach((product) => {
    const sections = normalizeSectionList(product.home_sections);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(product.title || "")}</td>
      <td><input type="checkbox" data-section="showcase_one" data-id="${product.id}" ${sections.includes("showcase_one") ? "checked" : ""} /></td>
      <td><input type="checkbox" data-section="showcase_two" data-id="${product.id}" ${sections.includes("showcase_two") ? "checked" : ""} /></td>
      <td><input type="checkbox" data-section="featured" data-id="${product.id}" ${sections.includes("featured") ? "checked" : ""} /></td>
      <td><input type="checkbox" data-section="new_arrivals" data-id="${product.id}" ${sections.includes("new_arrivals") ? "checked" : ""} /></td>
      <td><input type="checkbox" data-section="bestseller" data-id="${product.id}" ${sections.includes("bestseller") ? "checked" : ""} /></td>
      <td><input type="checkbox" data-section="premium_choice" data-id="${product.id}" ${sections.includes("premium_choice") ? "checked" : ""} /></td>
    `;
    sectionTableBody.appendChild(row);
  });

  sectionTableBody.querySelectorAll("input[data-section]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const sectionKey = event.target.getAttribute("data-section");
      const id = event.target.getAttribute("data-id");
      toggleSection(id, sectionKey, event.target.checked);
    });
  });
};

resetPositionState();
renderHeroPreviews();
loadHeroSlides();
loadSectionTable();
