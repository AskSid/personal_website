export const STATUS = {
  COMPLETE: 'complete',
  PARTIAL: 'partial',
  MISSED: 'missed'
};

export function todayIso() {
  return formatDateIso(new Date());
}

export function formatDateIso(date) {
  return date.toISOString().slice(0, 10);
}

export function getDateRange(days, endDate = new Date()) {
  const range = [];
  const end = new Date(endDate);
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
  if (thing.type === 'checkbox') {
    return false;
  }
  if (thing.type === 'text') {
    return '';
  }
  if (thing.type === 'counter' || thing.type === 'scale') {
    if (typeof thing.start === 'number') {
      return thing.start;
    }
    if (typeof thing.min === 'number') {
      return thing.min;
    }
    return 0;
  }
  return null;
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
