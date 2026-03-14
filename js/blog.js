const blogForm = document.querySelector("#blog-form");
const blogReset = document.querySelector("#blog-reset");
const blogStatus = document.querySelector("#blog-status");
const blogTableBody = document.querySelector("#blog-table tbody");

const setBlogStatus = (message) => {
  if (blogStatus) blogStatus.textContent = message;
};

const clearBlogForm = () => {
  blogForm.reset();
  document.querySelector("#blog-id").value = "";
  document.querySelector("#blog-active").checked = true;
};

const loadBlogs = async () => {\n  window.setAdminLoading?.(true);\n  window.renderSkeletonRows?.(blogTableBody, 3, 4);
  if (!window.gtSupabase1) {
    setBlogStatus("Supabase 1 keys missing in admin/js/config.js");
    return;
  }
  const { data, error } = await window.gtSupabase1
    .from("blogs")
    .select("*")
    .order("published_at", { ascending: false });

  if (error) {
    setBlogStatus(error.message);
    return;
  }

  blogTableBody.innerHTML = "";
  (data || []).forEach((blog) => {
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
      const { data, error } = await window.gtSupabase1
        .from("blogs")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        setBlogStatus(error.message);
        return;
      }
      document.querySelector("#blog-id").value = data.id || "";
      document.querySelector("#blog-title").value = data.title || "";
      document.querySelector("#blog-slug").value = data.slug || "";
      document.querySelector("#blog-url").value = data.url || "";
      document.querySelector("#blog-summary").value = data.summary || "";
      document.querySelector("#blog-image").value = data.image_url || "";
      document.querySelector("#blog-date").value = data.published_at ? data.published_at.split("T")[0] : "";
      document.querySelector("#blog-active").checked = data.is_active !== false;
    });
  });

  blogTableBody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete");
      if (!confirm("Delete this blog?")) return;
      const { error } = await window.gtSupabase1.from("blogs").delete().eq("id", id);
      if (error) {
        setBlogStatus(error.message);
        return;
      }
      loadBlogs();\nwindow.setAdminLoading?.(false);
    });
  });
};

if (blogForm) {
  blogForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!window.gtSupabase1) {
      setBlogStatus("Supabase 1 keys missing in admin/js/config.js");
      return;
    }

    const payload = {
      id: document.querySelector("#blog-id").value || undefined,
      title: document.querySelector("#blog-title").value.trim(),
      slug: document.querySelector("#blog-slug").value.trim(),
      url: document.querySelector("#blog-url").value.trim(),
      summary: document.querySelector("#blog-summary").value.trim(),
      image_url: document.querySelector("#blog-image").value.trim(),
      published_at: document.querySelector("#blog-date").value || null,
      is_active: document.querySelector("#blog-active").checked
    };

    if (!payload.title || !payload.slug) {
      setBlogStatus("Title and slug are required.");
      return;
    }

    const { error } = await window.gtSupabase1.from("blogs").upsert(payload, { onConflict: "slug" });
    if (error) {
      setBlogStatus(error.message);
      return;
    }
    setBlogStatus("Blog saved.");\n    window.showToast?.("Blog saved.");
    clearBlogForm();
    loadBlogs();\nwindow.setAdminLoading?.(false);
  });
}

if (blogReset) {
  blogReset.addEventListener("click", clearBlogForm);
}

loadBlogs();\nwindow.setAdminLoading?.(false);

