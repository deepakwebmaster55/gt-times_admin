const heroTableBody = document.querySelector("#hero-table tbody");
const heroForm = document.querySelector("#hero-form");
const heroReset = document.querySelector("#hero-reset");
const heroStatus = document.querySelector("#hero-status");
const sectionTableBody = document.querySelector("#section-table tbody");
const sectionStatus = document.querySelector("#section-status");

const setHeroStatus = (message) => {
  if (heroStatus) heroStatus.textContent = message;
};

const setSectionStatus = (message) => {
  if (sectionStatus) sectionStatus.textContent = message;
};

const clearHeroForm = () => {
  heroForm.reset();
  document.querySelector("#hero-id").value = "";
  document.querySelector("#hero-active").checked = true;
};

const loadHeroSlides = async () => {\n  window.setAdminLoading?.(true);\n  window.renderSkeletonRows?.(heroTableBody, 4, 3);
  if (!window.gtSupabase1) {
    setHeroStatus("Supabase 1 keys missing in admin/js/config.js");
    return;
  }
  const { data, error } = await window.gtSupabase1
    .from("home_sliders")
    .select("*")
    .order("order_index", { ascending: true });

  if (error) {
    setHeroStatus(error.message);
    return;
  }

  heroTableBody.innerHTML = "";
  (data || []).forEach((slide) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${slide.title || ""}</td>
      <td>${slide.order_index ?? 0}</td>
      <td><span class="badge">${slide.is_active ? "Active" : "Inactive"}</span></td>
      <td>
        <div class="actions-row">
          <button class="btn secondary" data-hero-edit="${slide.id}">Edit</button>
          <button class="btn link" data-hero-delete="${slide.id}">Delete</button>
        </div>
      </td>
    `;
    heroTableBody.appendChild(row);
  });

  heroTableBody.querySelectorAll("[data-hero-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-hero-edit");
      const { data, error } = await window.gtSupabase1
        .from("home_sliders")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        setHeroStatus(error.message);
        return;
      }
      document.querySelector("#hero-id").value = data.id || "";
      document.querySelector("#hero-eyebrow").value = data.eyebrow || "";
      document.querySelector("#hero-title").value = data.title || "";
      document.querySelector("#hero-subtitle").value = data.subtitle || "";
      document.querySelector("#hero-image").value = data.image_url || "";
      document.querySelector("#hero-primary-label").value = data.primary_cta_label || "";
      document.querySelector("#hero-primary-link").value = data.primary_cta_link || "";
      document.querySelector("#hero-secondary-label").value = data.secondary_cta_label || "";
      document.querySelector("#hero-secondary-link").value = data.secondary_cta_link || "";
      document.querySelector("#hero-order").value = data.order_index ?? 0;
      document.querySelector("#hero-active").checked = data.is_active !== false;
    });
  });

  heroTableBody.querySelectorAll("[data-hero-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-hero-delete");
      if (!confirm("Delete this slide?")) return;
      const { error } = await window.gtSupabase1.from("home_sliders").delete().eq("id", id);
      if (error) {
        setHeroStatus(error.message);
        return;
      }
      loadHeroSlides();\nwindow.setAdminLoading?.(false);
    });
  });
};

if (heroForm) {
  heroForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!window.gtSupabase1) {
      setHeroStatus("Supabase 1 keys missing in admin/js/config.js");
      return;
    }
    const payload = {
      id: document.querySelector("#hero-id").value || undefined,
      eyebrow: document.querySelector("#hero-eyebrow").value.trim(),
      title: document.querySelector("#hero-title").value.trim(),
      subtitle: document.querySelector("#hero-subtitle").value.trim(),
      image_url: document.querySelector("#hero-image").value.trim(),
      primary_cta_label: document.querySelector("#hero-primary-label").value.trim(),
      primary_cta_link: document.querySelector("#hero-primary-link").value.trim(),
      secondary_cta_label: document.querySelector("#hero-secondary-label").value.trim(),
      secondary_cta_link: document.querySelector("#hero-secondary-link").value.trim(),
      order_index: Number(document.querySelector("#hero-order").value || 0),
      is_active: document.querySelector("#hero-active").checked
    };

    if (!payload.title || !payload.image_url) {
      setHeroStatus("Title and image URL are required.");
      return;
    }

    const { error } = await window.gtSupabase1.from("home_sliders").upsert(payload);
    if (error) {
      setHeroStatus(error.message);
      return;
    }
    setHeroStatus("Slide saved.");\n    window.showToast?.("Slide saved.");
    clearHeroForm();
    loadHeroSlides();\nwindow.setAdminLoading?.(false);
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
  const sections = data.home_sections || [];
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
  setSectionStatus("Sections updated.");\n  window.showToast?.("Sections updated.");
};

const loadSectionTable = async () => {\n  window.renderSkeletonRows?.(sectionTableBody, 6, 4);
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
    const sections = product.home_sections || [];
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${product.title || ""}</td>
      <td><input type="checkbox" data-section="featured" data-id="${product.id}" ${sections.includes("featured") ? "checked" : ""} /></td>
      <td><input type="checkbox" data-section="new_arrivals" data-id="${product.id}" ${sections.includes("new_arrivals") ? "checked" : ""} /></td>
      <td><input type="checkbox" data-section="bestseller" data-id="${product.id}" ${sections.includes("bestseller") ? "checked" : ""} /></td>
      <td><input type="checkbox" data-section="premium_choice" data-id="${product.id}" ${sections.includes("premium_choice") ? "checked" : ""} /></td>
      <td><input type="checkbox" data-section="signature_showcase" data-id="${product.id}" ${sections.includes("signature_showcase") ? "checked" : ""} /></td>
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

loadHeroSlides();\nwindow.setAdminLoading?.(false);\nloadSectionTable();



