import { createSupabaseProvider } from './providers/supabaseProvider.js';
import { getConfig, hasSupabaseCredentials } from './config.js';
import { normaliseDateInput, todayIso } from './utils.js';

const defaultEnv = typeof process !== 'undefined' && process.env ? process.env : {};

export function createTrackingService(envSource = defaultEnv) {
  const config = getConfig(envSource);
  if (!hasSupabaseCredentials(config)) {
    throw new Error('Tracking API requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const provider = createSupabaseProvider(config);

  function getDefaultLookback(days) {
    if (days && Number.isFinite(Number(days))) {
      return Math.max(1, Number(days));
    }
    return config.historyLookback;
  }

  async function fetchGlobalSnapshot(days) {
    const lookback = getDefaultLookback(days);
    return provider.getGlobalSnapshot(lookback);
  }

  async function fetchDailySnapshot(date) {
    const targetDate = normaliseDateInput(date) ?? todayIso();
    return provider.getDailyPayload(targetDate);
  }

  async function persistDailyEntries(date, updates) {
    const targetDate = normaliseDateInput(date) ?? todayIso();
    return provider.saveDailyEntries(targetDate, updates ?? []);
  }

  return {
    config,
    getDefaultLookback,
    fetchGlobalSnapshot,
    fetchDailySnapshot,
    persistDailyEntries
  };
}
