const reviewForm = document.querySelector("#review-form");
const reviewReset = document.querySelector("#review-reset");
const reviewStatus = document.querySelector("#review-status");
const reviewTableBody = document.querySelector("#review-table tbody");

const setReviewStatus = (message) => {
  if (reviewStatus) reviewStatus.textContent = message;
};

const clearReviewForm = () => {
  reviewForm.reset();
  document.querySelector("#review-id").value = "";
  document.querySelector("#review-active").checked = true;
};

const loadReviews = async () => {\n  window.setAdminLoading?.(true);\n  window.renderSkeletonRows?.(reviewTableBody, 4, 4);
  if (!window.gtSupabase2) {
    setReviewStatus("Supabase 2 keys missing in admin/js/config.js");
    return;
  }
  const { data, error } = await window.gtSupabase2
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    setReviewStatus(error.message);
    return;
  }

  reviewTableBody.innerHTML = "";
  (data || []).forEach((review) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${review.name || ""}</td>
      <td>${review.rating || ""}</td>
      <td><span class="badge">${review.is_active ? "Active" : "Inactive"}</span></td>
      <td>
        <div class="actions-row">
          <button class="btn secondary" data-edit="${review.id}">Edit</button>
          <button class="btn link" data-delete="${review.id}">Delete</button>
        </div>
      </td>
    `;
    reviewTableBody.appendChild(row);
  });

  reviewTableBody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit");
      const { data, error } = await window.gtSupabase2
        .from("reviews")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        setReviewStatus(error.message);
        return;
      }
      document.querySelector("#review-id").value = data.id || "";
      document.querySelector("#review-name").value = data.name || "";
      document.querySelector("#review-email").value = data.email || "";
      document.querySelector("#review-rating").value = data.rating || "";
      document.querySelector("#review-feedback").value = data.feedback || "";
      document.querySelector("#review-active").checked = data.is_active !== false;
    });
  });

  reviewTableBody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete");
      if (!confirm("Delete this review?")) return;
      const { error } = await window.gtSupabase2.from("reviews").delete().eq("id", id);
      if (error) {
        setReviewStatus(error.message);
        return;
      }
      loadReviews();\nwindow.setAdminLoading?.(false);
    });
  });
};

if (reviewForm) {
  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!window.gtSupabase2) {
      setReviewStatus("Supabase 2 keys missing in admin/js/config.js");
      return;
    }

    const payload = {
      id: document.querySelector("#review-id").value || undefined,
      name: document.querySelector("#review-name").value.trim(),
      email: document.querySelector("#review-email").value.trim(),
      rating: Number(document.querySelector("#review-rating").value || 0),
      feedback: document.querySelector("#review-feedback").value.trim(),
      is_active: document.querySelector("#review-active").checked
    };

    if (!payload.name) {
      setReviewStatus("Name is required.");
      return;
    }

    const { error } = await window.gtSupabase2.from("reviews").upsert(payload);
    if (error) {
      setReviewStatus(error.message);
      return;
    }
    setReviewStatus("Review saved.");\n    window.showToast?.("Review saved.");
    clearReviewForm();
    loadReviews();\nwindow.setAdminLoading?.(false);
  });
}

if (reviewReset) {
  reviewReset.addEventListener("click", clearReviewForm);
}

loadReviews();\nwindow.setAdminLoading?.(false);

