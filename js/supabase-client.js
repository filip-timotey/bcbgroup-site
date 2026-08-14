import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://igxkzgsxokdsfgkatkud.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8uI8lB0bROV4u3Z5B3NaCw_xCEtQ1g-";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
