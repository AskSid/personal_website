import { computeStatusForThing, defaultValueForThing, getDateRange } from '../utils.js';

function extractMetadata(row) {
  const metaRaw =
    row.target_metadata ??
    row.targetMetadata ??
    row.metadata ??
    row['target metadata'] ??
    null;
  if (!metaRaw) {
    return {};
  }
  if (typeof metaRaw === 'object') {
    return metaRaw;
  }
  try {
    return JSON.parse(metaRaw);
  } catch (error) {
    return {};
  }
}

function mapThingRow(row) {
  const meta = extractMetadata(row);
  const parseNumber = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const pickDefaultCandidate = () => {
    if (row.default_value !== undefined) return row.default_value;
    if (row.defaultValue !== undefined) return row.defaultValue;
    if (row.start_value !== undefined) return row.start_value;
    if (meta.default !== undefined) return meta.default;
    if (meta.default_value !== undefined) return meta.default_value;
    if (meta.start !== undefined) return meta.start;
    return undefined;
  };

  const coerceDefaultValue = (type, raw) => {
    if (raw === undefined) {
      return undefined;
    }
    if (raw === null) {
      return null;
    }
    if (type === 'checkbox') {
      if (typeof raw === 'boolean') {
        return raw;
      }
      if (typeof raw === 'number') {
        return raw !== 0;
      }
      if (typeof raw === 'string') {
        const normalised = raw.trim().toLowerCase();
        if (normalised === 'true' || normalised === '1') {
          return true;
        }
        if (normalised === 'false' || normalised === '0') {
          return false;
        }
      }
      throw new Error(`Invalid default for checkbox tracker ${row.id}.`);
    }
    if (type === 'counter' || type === 'scale') {
      if (typeof raw === 'number') {
        return raw;
      }
      if (typeof raw === 'string' && raw.trim() !== '') {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      throw new Error(`Invalid numeric default for tracker ${row.id}.`);
    }
    return raw;
  };

  const defaultValue = coerceDefaultValue(row.type, pickDefaultCandidate());

  return {
    id: row.id,
    label: row.label ?? row.name ?? '',
    description: row.description ?? '',
    icon: row.icon ?? '',
    type: row.type,
    target: parseNumber(row.target ?? meta.target),
    unit: row.unit ?? row.units ?? meta.unit ?? '',
    min: parseNumber(row.min_value ?? meta.min ?? meta.min_value),
    max: parseNumber(row.max_value ?? meta.max ?? meta.max_value),
    step: parseNumber(row.step ?? meta.step) ?? 1,
    defaultValue
  };
}

function resolveEntryValue(entry, thing) {
  const raw = entry.value ?? entry.value_numeric ?? entry.value_boolean ?? entry.value_json;
  if (thing?.type === 'text') {
    return raw === null || raw === undefined ? '' : String(raw);
  }
  if (thing?.type === 'checkbox') {
    if (typeof raw === 'boolean') {
      return raw;
    }
    if (typeof raw === 'string') {
      return raw.toLowerCase() === 'true' || raw === '1';
    }
    return Boolean(raw);
  }
  if (typeof raw === 'number') {
    return raw;
  }
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return raw ?? null;
}

export function createSupabaseProvider(config) {
  const baseHeaders = {
    apikey: config.supabaseKey,
    Authorization: `Bearer ${config.supabaseKey}`,
    'Content-Type': 'application/json'
  };

  const thingsEndpoint = `${config.supabaseUrl}/rest/v1/${config.thingsTable}`;
  const entriesEndpoint = `${config.supabaseUrl}/rest/v1/${config.entriesTable}`;

  const serialiseEntryValue = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    return String(value);
  };

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...baseHeaders,
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase error ${response.status}: ${text}`);
    }
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return null;
    }
    const text = await response.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text);
  }

  async function listThings() {
    const url = new URL(thingsEndpoint);
    url.searchParams.set('select', '*');
    const rows = (await fetchJson(url)) ?? [];
    return rows.map(mapThingRow);
  }

  async function listEntriesSince(startDate) {
    const url = new URL(entriesEndpoint);
    url.searchParams.set('select', '*');
    url.searchParams.set('entry_date', `gte.${startDate}`);
    url.searchParams.set('order', 'entry_date.asc');
    return (await fetchJson(url)) ?? [];
  }

  async function persistEntries(payload) {
    if (!payload.length) {
      return;
    }
    await fetchJson(entriesEndpoint, {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });
  }

  async function listEntriesForDate(date) {
    const url = new URL(entriesEndpoint);
    url.searchParams.set('select', '*');
    url.searchParams.set('entry_date', `eq.${date}`);
    return (await fetchJson(url)) ?? [];
  }

  async function getGlobalSnapshot(days) {
    const things = await listThings();
    if (!things.length) {
      return { trackers: [] };
    }
    const dateRange = getDateRange(days);
    const firstDay = dateRange[0];
    const entries = await listEntriesSince(firstDay);
    const entriesByThingDate = new Map();
    entries.forEach((entry) => {
      entriesByThingDate.set(`${entry.tracking_id}-${entry.entry_date}`, entry);
    });

      const trackers = things.map((thing) => {
        const history = dateRange.map((date) => {
          const row = entriesByThingDate.get(`${thing.id}-${date}`);
          const value = row ? resolveEntryValue(row, thing) : null;
          const numericValue = typeof value === 'number'
            ? value
            : typeof value === 'string'
            ? Number(value)
            : null;
          return {
            date,
            status: computeStatusForThing(thing, value),
            value,
            numericValue: Number.isFinite(numericValue) ? numericValue : null
          };
        });
        const recent = history.slice(-7);
        const recentWins = recent.filter((entry) => entry.status !== 'missed').length;
        const completionRate = Math.round(
          (history.filter((entry) => entry.status === 'complete').length / history.length) * 100
        );
        return {
          id: thing.id,
          label: thing.label,
          description: thing.description,
          icon: thing.icon,
          type: thing.type,
          target: thing.target ?? null,
          unit: thing.unit ?? '',
          history,
          summary: {
            recentWins,
            completionRate
          }
      };
    });

    return { trackers };
  }

  async function getDailyPayload(date) {
    const [things, entries] = await Promise.all([listThings(), listEntriesForDate(date)]);
    const entriesByThing = new Map();
    entries.forEach((entry) => {
      entriesByThing.set(entry.tracking_id, entry);
    });

    const missingThings = things.filter((thing) => !entriesByThing.has(thing.id));
    if (missingThings.length) {
      const seedPayload = missingThings.map((thing) => {
        const value = defaultValueForThing(thing);
        return {
          tracking_id: thing.id,
          entry_date: date,
          value: serialiseEntryValue(value)
        };
      });
      await persistEntries(seedPayload);
      missingThings.forEach((thing, index) => {
        entriesByThing.set(thing.id, {
          tracking_id: thing.id,
          entry_date: date,
          value: seedPayload[index].value
        });
      });
    }

    return {
      date,
      trackers: things.map((thing) => {
        const row = entriesByThing.get(thing.id);
        const value = row ? resolveEntryValue(row, thing) : defaultValueForThing(thing);
        return {
          id: thing.id,
          label: thing.label,
          description: thing.description,
          icon: thing.icon,
          type: thing.type,
          target: thing.target ?? null,
          unit: thing.unit ?? '',
          min: thing.min ?? null,
          max: thing.max ?? null,
          step: thing.step ?? 1,
          value,
          defaultValue: defaultValueForThing(thing)
        };
      })
    };
  }

  async function saveDailyEntries(date, updates) {
    if (!updates?.length) {
      return getDailyPayload(date);
    }
    const entries = await listEntriesForDate(date);
    const entriesByThing = new Map();
    entries.forEach((entry) => {
      entriesByThing.set(entry.tracking_id, entry);
    });

    const payload = updates.map((update) => {
      const row = entriesByThing.get(update.thingId);
      const nextValue = update.value === undefined ? null : update.value;
      return {
        id: row?.id,
        tracking_id: update.thingId,
        entry_date: date,
        value: serialiseEntryValue(nextValue)
      };
    });

    await persistEntries(payload);

    return getDailyPayload(date);
  }

  return {
    getGlobalSnapshot,
    getDailyPayload,
    saveDailyEntries
  };
}
