import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const missingKeys = [];

if (!supabaseUrl) missingKeys.push("SUPABASE_URL");
if (!supabaseServiceRoleKey) missingKeys.push("SUPABASE_SERVICE_ROLE_KEY");

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);
export const supabaseConfigError = missingKeys.length
  ? `Missing required backend env vars: ${missingKeys.join(", ")}`
  : "";

export const supabaseAdmin = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
