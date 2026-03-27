/**
 * Client Supabase avec service role key (accès complet, bypass RLS).
 * Utilise SUPABASE_SERVICE_KEY (à définir dans Railway et .env.local).
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://boshhrzirumhxalhqxmj.supabase.co";

let _client = null;

function getSupabaseAdmin() {
  if (_client) return _client;

  const serviceKey = (process.env.SUPABASE_SERVICE_KEY || "").trim();
  if (!serviceKey) {
    const err = new Error(
      "SUPABASE_SERVICE_KEY manquant — ajoute-la dans Railway (Settings → Variables) et dans .env.local"
    );
    err.code = "SUPABASE_CONFIG";
    throw err;
  }

  _client = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _client;
}

module.exports = { getSupabaseAdmin };
