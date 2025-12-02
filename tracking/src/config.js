import dotenv from 'dotenv';

dotenv.config();

export function getConfig() {
  const {
    PORT = '4100',
    SUPABASE_URL = '',
    SUPABASE_SERVICE_ROLE_KEY = '',
    SUPABASE_THINGS_TABLE = 'things_to_track',
    SUPABASE_ENTRIES_TABLE = 'tracking_entries',
    SUPABASE_HISTORY_LOOKBACK = '30'
  } = process.env;

  const historyLookback = Number.parseInt(SUPABASE_HISTORY_LOOKBACK, 10);

  return {
    port: Number.parseInt(PORT, 10) || 4100,
    supabaseUrl: SUPABASE_URL.trim(),
    supabaseKey: SUPABASE_SERVICE_ROLE_KEY.trim(),
    thingsTable: SUPABASE_THINGS_TABLE.trim() || 'things_to_track',
    entriesTable: SUPABASE_ENTRIES_TABLE.trim() || 'tracking_entries',
    historyLookback: Number.isFinite(historyLookback) ? historyLookback : 30
  };
}

export function hasSupabaseCredentials(config) {
  return Boolean(config.supabaseUrl && config.supabaseKey);
}
