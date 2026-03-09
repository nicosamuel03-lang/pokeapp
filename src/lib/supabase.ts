import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? "https://boshhrzirumhxalhqxmj.supabase.co";
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "sb_publishable_h1bbnWQaVV2Omox__gZrsQ_rrU9yVVb";

export const supabase = createClient(supabaseUrl, supabaseKey);
