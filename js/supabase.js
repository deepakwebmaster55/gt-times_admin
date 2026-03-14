const adminConfig = window.GT_ADMIN_CONFIG || {};

const supabase1Config = adminConfig.supabase1 || {};
const supabase2Config = adminConfig.supabase2 || {};

const supabase1 = supabase1Config.url && supabase1Config.anonKey
  ? supabase.createClient(supabase1Config.url, supabase1Config.anonKey)
  : null;

const supabase2 = supabase2Config.url && supabase2Config.anonKey
  ? supabase.createClient(supabase2Config.url, supabase2Config.anonKey)
  : null;

const getAdminAccessToken = async () => {
  if (!supabase1) return "";
  const { data } = await supabase1.auth.getSession();
  return data?.session?.access_token || "";
};

const callSupabase2AdminFunction = async (path, payload) => {
  const baseUrl = supabase2Config.functionsUrl || (supabase2Config.url ? `${supabase2Config.url}/functions/v1` : "");
  if (!baseUrl) throw new Error("Supabase 2 functions URL missing in admin/js/config.js");

  const token = await getAdminAccessToken();
  if (!token) throw new Error("Admin session expired. Please login again.");

  const response = await fetch(`${baseUrl}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload || {})
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || response.statusText);
  }

  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
};

window.gtSupabase1 = supabase1;
window.gtSupabase2 = supabase2;
window.getAdminAccessToken = getAdminAccessToken;
window.callSupabase2AdminFunction = callSupabase2AdminFunction;
