const categoryForm = document.querySelector("#category-form");
const categoryReset = document.querySelector("#category-reset");
const categoryStatus = document.querySelector("#category-status");
const categoryTableBody = document.querySelector("#category-table tbody");
const assignSelect = document.querySelector("#assign-category");
const assignTableBody = document.querySelector("#assign-table tbody");
const assignStatus = document.querySelector("#assign-status");
const categoryImageInput = document.querySelector("#category-image");
const categoryImageStatus = document.querySelector("#category-image-status");
const categoryImagePreview = document.querySelector("#category-image-preview");

const STORAGE_BUCKET = "product-images";
let categoryImageUrl = "";

const setCategoryStatus = (message) => {
  if (categoryStatus) categoryStatus.textContent = message;
};

const setAssignStatus = (message) => {
  if (assignStatus) assignStatus.textContent = message;
};

const setImageStatus = (message) => {
  if (categoryImageStatus) categoryImageStatus.textContent = message;
};

const renderImagePreview = () => {
  if (!categoryImagePreview) return;
  if (!categoryImageUrl) {
    categoryImagePreview.textContent = "No image uploaded yet.";
    return;
  }
  categoryImagePreview.innerHTML = `Current image: <a href="${categoryImageUrl}" target="_blank" rel="noopener">${categoryImageUrl}</a>`;
};

const sanitizeFileName = (name) => name.replace(/[^a-z0-9._-]/gi, "_");

const uploadToStorage = async (file, slug) => {
  if (!window.gtSupabase1) return "";
  const fileName = sanitizeFileName(file.name);
  const path = `categories/${slug}/${Date.now()}_${fileName}`;
  const { error } = await window.gtSupabase1.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true
  });
  if (error) {
    setCategoryStatus(error.message);
    return "";
  }
  const { data } = window.gtSupabase1.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
};

const clearCategoryForm = () => {
  categoryForm.reset();
  document.querySelector("#category-id").value = "";
  document.querySelector("#category-active").checked = true;
  categoryImageUrl = "";
  if (categoryImageInput) categoryImageInput.value = "";
  renderImagePreview();
};

const loadCategories = async () => {
  window.setAdminLoading?.(true);
  window.renderSkeletonRows?.(categoryTableBody, 4, 4);
  if (!window.gtSupabase1) {
    setCategoryStatus("Supabase 1 keys missing in admin/js/config.js");
    return;
  }
  const { data, error } = await window.gtSupabase1
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    setCategoryStatus(error.message);
    return;
  }

  renderCategories(data || []);
  window.setAdminLoading?.(false);
  populateAssignSelect(data || []);
};

const renderCategories = (categories) => {
  categoryTableBody.innerHTML = "";
  categories.forEach((category) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${category.name || ""}</td>
      <td>${category.slug || ""}</td>
      <td><span class="badge">${category.is_active ? "Active" : "Inactive"}</span></td>
      <td>
        <div class="actions-row">
          <button class="btn secondary" data-edit="${category.id}">Edit</button>
          <button class="btn link" data-delete="${category.id}">Delete</button>
        </div>
      </td>
    `;
    categoryTableBody.appendChild(row);
  });

  categoryTableBody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit");
      const { data, error } = await window.gtSupabase1
        .from("categories")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        setCategoryStatus(error.message);
        return;
      }
      document.querySelector("#category-id").value = data.id || "";
      document.querySelector("#category-name").value = data.name || "";
      document.querySelector("#category-slug").value = data.slug || "";
      document.querySelector("#category-desc").value = data.description || "";
      document.querySelector("#category-active").checked = data.is_active !== false;
      categoryImageUrl = data.image_url || "";
      renderImagePreview();
    });
  });

  categoryTableBody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete");
      if (!confirm("Delete this category?")) return;
      const { error } = await window.gtSupabase1.from("categories").delete().eq("id", id);
      if (error) {
        setCategoryStatus(error.message);
        return;
      }
      loadCategories();
    });
  });
};

const populateAssignSelect = (categories) => {
  assignSelect.innerHTML = "";
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.slug;
    option.textContent = category.name;
    assignSelect.appendChild(option);
  });
  if (categories.length > 0) {
    loadAssignTable(categories[0].slug);
  }
};

const loadAssignTable = async (slug) => {
  if (!window.gtSupabase1) {
    setAssignStatus("Supabase 1 keys missing in admin/js/config.js");
    return;
  }
  const { data, error } = await window.gtSupabase1
    .from("products")
    .select("id, title, category")
    .order("title", { ascending: true });

  if (error) {
    setAssignStatus(error.message);
    return;
  }

  assignTableBody.innerHTML = "";
  (data || []).forEach((product) => {
    const checked = product.category === slug;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${product.title || ""}</td>
      <td><input type="checkbox" data-id="${product.id}" ${checked ? "checked" : ""} /></td>
    `;
    assignTableBody.appendChild(row);
  });

  assignTableBody.querySelectorAll("input[type=checkbox]").forEach((checkbox) => {
    checkbox.addEventListener("change", async (event) => {
      const productId = event.target.getAttribute("data-id");
      const updateCategory = event.target.checked ? slug : "";
      const { error: updateError } = await window.gtSupabase1
        .from("products")
        .update({ category: updateCategory })
        .eq("id", productId);
      if (updateError) {
        setAssignStatus(updateError.message);
        return;
      }
      setAssignStatus("Category updated.");
      window.showToast?.("Category updated.");
    });
  });
};

if (assignSelect) {
  assignSelect.addEventListener("change", (event) => {
    loadAssignTable(event.target.value);
  });
}

if (categoryImageInput) {
  categoryImageInput.addEventListener("change", async () => {
    if (!categoryImageInput.files?.length) return;
    const slug = document.querySelector("#category-slug").value.trim() || "category";
    setImageStatus("Uploading image...");
    const url = await uploadToStorage(categoryImageInput.files[0], slug);
    if (url) {
      categoryImageUrl = url;
      setImageStatus("Image uploaded.");
      window.showToast?.("Image uploaded.");
    }
    renderImagePreview();
  });
}

if (categoryForm) {
  categoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!window.gtSupabase1) {
      setCategoryStatus("Supabase 1 keys missing in admin/js/config.js");
      return;
    }

    const payload = {
      id: document.querySelector("#category-id").value || undefined,
      name: document.querySelector("#category-name").value.trim(),
      slug: document.querySelector("#category-slug").value.trim(),
      image_url: categoryImageUrl,
      description: document.querySelector("#category-desc").value.trim(),
      is_active: document.querySelector("#category-active").checked
    };

    if (!payload.name || !payload.slug) {
      setCategoryStatus("Name and slug are required.");
      return;
    }
    if (!payload.image_url) {
      setCategoryStatus("Image is required.");
      return;
    }

    const { error } = await window.gtSupabase1.from("categories").upsert(payload, { onConflict: "slug" });
    if (error) {
      setCategoryStatus(error.message);
      return;
    }
    setCategoryStatus("Category saved.");
    window.showToast?.("Category saved.");
    clearCategoryForm();
    loadCategories();
  });
}

if (categoryReset) {
  categoryReset.addEventListener("click", clearCategoryForm);
}

loadCategories();
