export const STATUS = {
  COMPLETE: 'complete',
  PARTIAL: 'partial',
  MISSED: 'missed'
};

/**
 * Gets the current date string in Eastern Time (EST/EDT)
 * Eastern Time is UTC-5 (EST) or UTC-4 (EDT during daylight saving)
 * Returns ISO date string (YYYY-MM-DD) in Eastern Time
 */
function getEasternDateString(date = new Date()) {
  // Use Intl.DateTimeFormat to get the date components in Eastern Time
  // This handles DST automatically
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  
  return `${year}-${month}-${day}`;
}

/**
 * Gets a Date object representing the given date in Eastern Time
 * Used for date arithmetic (e.g., in getDateRange)
 */
function getEasternDate(date = new Date()) {
  const dateString = getEasternDateString(date);
  const [year, month, day] = dateString.split('-').map(Number);
  // Create date at midnight - the date components are already correct for Eastern Time
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function todayIso() {
  return getEasternDateString();
}

export function formatDateIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateRange(days, endDate = new Date()) {
  const range = [];
  const end = getEasternDate(endDate);
  end.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    range.push(formatDateIso(d));
  }
  return range;
}

export function normaliseDateInput(input) {
  if (!input) {
    return null;
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return formatDateIso(date);
}

export function defaultValueForThing(thing) {
  if (!thing || !Object.prototype.hasOwnProperty.call(thing, 'defaultValue')) {
    throw new Error('Thing is missing a configured default value.');
  }
  if (thing.defaultValue === undefined) {
    throw new Error('Thing is missing a configured default value.');
  }
  return thing.defaultValue;
}

export function computeStatusForThing(thing, value) {
  if (value === null || value === undefined) {
    return STATUS.MISSED;
  }

  if (thing.type === 'checkbox') {
    return value ? STATUS.COMPLETE : STATUS.MISSED;
  }

  if (thing.type === 'text') {
    return String(value).trim() ? STATUS.COMPLETE : STATUS.MISSED;
  }

  if (typeof value === 'number' && typeof thing.target === 'number') {
    if (value >= thing.target) {
      return STATUS.COMPLETE;
    }
    return value > 0 ? STATUS.PARTIAL : STATUS.MISSED;
  }

  return STATUS.MISSED;
}

export function parseIncomingValue(thing, value) {
  if (thing.type === 'checkbox') {
    return Boolean(value);
  }
  if (thing.type === 'text') {
    return value === null || value === undefined ? '' : String(value);
  }
  if (thing.type === 'counter' || thing.type === 'scale') {
    if (typeof value === 'number') {
      return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValueForThing(thing);
  }
  return value;
}

export function valueSummaryText(thing, value) {
  if (thing.type === 'checkbox') {
    return value ? 'Done' : 'Not logged';
  }
  if (thing.type === 'text') {
    return value ? String(value) : 'Not logged';
  }
  if (typeof value === 'number') {
    return `${value}${thing.unit ? ` ${thing.unit}` : ''}`;
  }
  return '';
}
