const adminConfig = window.GT_ADMIN_CONFIG || {};

const supabase1Config = adminConfig.supabase1 || {};
const supabase2Config = adminConfig.supabase2 || {};

const supabase1 = supabase1Config.url && supabase1Config.anonKey
  ? supabase.createClient(supabase1Config.url, supabase1Config.anonKey)
  : null;

const supabase2 = supabase2Config.url && supabase2Config.anonKey
  ? supabase.createClient(supabase2Config.url, supabase2Config.anonKey)
  : null;

window.gtSupabase1 = supabase1;
window.gtSupabase2 = supabase2;
