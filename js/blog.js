const blogForm = document.querySelector("#blog-form");
const blogReset = document.querySelector("#blog-reset");
const blogStatus = document.querySelector("#blog-status");
const blogTableBody = document.querySelector("#blog-table tbody");
const blogImageInput = document.querySelector("#blog-image");
const blogImageStatus = document.querySelector("#blog-image-status");
const blogImagePreview = document.querySelector("#blog-image-preview");

const STORAGE_BUCKET = "product-images";
let blogImageUrl = "";

const setBlogStatus = (message) => {
  if (blogStatus) blogStatus.textContent = message;
};

const setImageStatus = (message) => {
  if (blogImageStatus) blogImageStatus.textContent = message;
};

const renderImagePreview = () => {
  if (!blogImagePreview) return;
  if (!blogImageUrl) {
    blogImagePreview.textContent = "No image uploaded yet.";
    return;
  }
  blogImagePreview.innerHTML = `Current image: <a href="${blogImageUrl}" target="_blank" rel="noopener">${blogImageUrl}</a>`;
};

const sanitizeFileName = (name) => name.replace(/[^a-z0-9._-]/gi, "_");

const uploadToStorage = async (file, slug) => {
  if (!window.gtSupabase1) return "";
  const fileName = sanitizeFileName(file.name);
  const path = `blogs/${slug}/${Date.now()}_${fileName}`;

  const { error } = await window.gtSupabase1.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "image/jpeg"
  });
  if (error) {
    setBlogStatus(error.message || "Image upload failed.");
    return "";
  }

  const { data } = window.gtSupabase1.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
};

const clearBlogForm = () => {
  blogForm.reset();
  document.querySelector("#blog-id").value = "";
  document.querySelector("#blog-active").checked = true;
  blogImageUrl = "";
  if (blogImageInput) blogImageInput.value = "";
  renderImagePreview();
};

const loadBlogs = async () => {
  window.setAdminLoading?.(true);
  window.renderSkeletonRows?.(blogTableBody, 3, 4);
  try {
    if (!window.callSupabase2AdminFunction) {
      setBlogStatus("Supabase 2 admin function is unavailable.");
      return;
    }
    let result;
    result = await window.callSupabase2AdminFunction("admin-blogs", { action: "list" });
    blogTableBody.innerHTML = "";
    (result.blogs || []).forEach((blog) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${blog.title || ""}</td>
        <td><span class="badge">${blog.is_active ? "Active" : "Inactive"}</span></td>
        <td>
          <div class="actions-row">
            <button class="btn secondary" data-edit="${blog.id}">Edit</button>
            <button class="btn link" data-delete="${blog.id}">Delete</button>
          </div>
        </td>
      `;
      blogTableBody.appendChild(row);
    });

    blogTableBody.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-edit");
        let result;
        try {
          result = await window.callSupabase2AdminFunction("admin-blogs", { action: "get", id });
        } catch (error) {
          setBlogStatus(error.message || "Unable to load blog.");
          return;
        }
        const data = result.blog || null;
        if (!data) {
          setBlogStatus("Blog not found.");
          return;
        }
        document.querySelector("#blog-id").value = data.id || "";
        document.querySelector("#blog-title").value = data.title || "";
        document.querySelector("#blog-slug").value = data.slug || "";
        document.querySelector("#blog-summary").value = data.summary || "";
        blogImageUrl = data.image_url || "";
        document.querySelector("#blog-date").value = data.published_at ? data.published_at.split("T")[0] : "";
        document.querySelector("#blog-active").checked = data.is_active !== false;
        renderImagePreview();
      });
    });

    blogTableBody.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete");
        if (!confirm("Delete this blog?")) return;
        try {
          await window.callSupabase2AdminFunction("admin-blogs", { action: "delete", id });
        } catch (error) {
          setBlogStatus(error.message || "Unable to delete blog.");
          return;
        }
        loadBlogs();
      });
    });
  } catch (error) {
    setBlogStatus(error.message || "Unable to load blogs.");
  } finally {
    window.setAdminLoading?.(false);
  }
};

if (blogImageInput) {
  blogImageInput.addEventListener("change", async () => {
    if (!blogImageInput.files?.length) return;
    const slug = document.querySelector("#blog-slug").value.trim() || "blog";
    setImageStatus("Uploading image...");
    const url = await uploadToStorage(blogImageInput.files[0], slug);
    if (url) {
      blogImageUrl = url;
      setImageStatus("Image uploaded.");
      window.showToast?.("Image uploaded.");
    } else {
      setImageStatus("Image upload failed.");
    }
    renderImagePreview();
  });
}

if (blogForm) {
  blogForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!window.callSupabase2AdminFunction) {
      setBlogStatus("Supabase 2 admin function is unavailable.");
      return;
    }

    const payload = {
      id: document.querySelector("#blog-id").value || undefined,
      title: document.querySelector("#blog-title").value.trim(),
      slug: document.querySelector("#blog-slug").value.trim(),
      summary: document.querySelector("#blog-summary").value.trim(),
      image_url: blogImageUrl,
      published_at: document.querySelector("#blog-date").value || null,
      is_active: document.querySelector("#blog-active").checked
    };

    if (!payload.title || !payload.slug) {
      setBlogStatus("Title and slug are required.");
      return;
    }
    if (!payload.image_url) {
      setBlogStatus("Image is required.");
      return;
    }

    try {
      await window.callSupabase2AdminFunction("admin-blogs", { action: "upsert", blog: payload });
    } catch (error) {
      setBlogStatus(error.message || "Unable to save blog.");
      return;
    }
    setBlogStatus("Blog saved.");
    window.showToast?.("Blog saved.");
    clearBlogForm();
    loadBlogs();
    window.setAdminLoading?.(false);
  });
}

if (blogReset) {
  blogReset.addEventListener("click", clearBlogForm);
}

loadBlogs();
