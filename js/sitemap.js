const sitemapBtn = document.querySelector("[data-generate-sitemap]");

const staticUrls = [
  "https://glamtreasure.shop/",
  "https://glamtreasure.shop/shop.html",
  "https://glamtreasure.shop/categories.html",
  "https://glamtreasure.shop/about.html",
  "https://glamtreasure.shop/blog.html",
  "https://glamtreasure.shop/blog-watch-care.html",
  "https://glamtreasure.shop/blog-luxury-vs-everyday.html",
  "https://glamtreasure.shop/blog-accessory-style.html",
  "https://glamtreasure.shop/blog-perfume-guide.html",
  "https://glamtreasure.shop/policies.html",
  "https://glamtreasure.shop/contact.html",
  "https://glamtreasure.shop/faq.html"
];

const buildSitemapXml = (productUrls = []) => {
  const urls = [...new Set([...staticUrls, ...productUrls])];
  const body = urls
    .map((loc) => {
      return `
  <url>
    <loc>${loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}\n</urlset>`;
};

const downloadFile = (content, filename) => {
  const blob = new Blob([content], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const generateSitemap = async () => {
  if (!window.gtSupabase1) return;
  window.setAdminLoading?.(true);
  const { data, error } = await window.gtSupabase1
    .from("products")
    .select("slug,id")
    .neq("is_active", false);
  window.setAdminLoading?.(false);
  if (error) {
    window.showToast?.("Failed to fetch products for sitemap.");
    return;
  }
  const productUrls = (data || [])
    .map((item) => item.slug || item.id)
    .filter(Boolean)
    .map((id) => `https://glamtreasure.shop/product-royal-crown-gold.html?watch=${encodeURIComponent(id)}`);
  const xml = buildSitemapXml(productUrls);
  downloadFile(xml, "sitemap.xml");
  window.showToast?.("Sitemap downloaded. Upload it to your site root.");
};

if (sitemapBtn) {
  sitemapBtn.addEventListener("click", generateSitemap);
}
