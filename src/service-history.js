const STORAGE_KEY = 'xswift-service-history-v1';
const MAX_RECORDS = 500;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_AMOUNT = 100_000_000;

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function normalizeServiceHistory(records) {
  if (!Array.isArray(records) || records.length > MAX_RECORDS) {
    throw new Error('Service history must contain no more than 500 records.');
  }
  const normalized = records.map(record => {
    const id = String(record?.id || '').trim();
    const date = String(record?.date || '').trim();
    const description = String(record?.description || '').trim();
    const amount = Number(record?.amount);
    const createdAt = String(record?.createdAt || '');
    if (!/^[\w-]{1,80}$/.test(id) || !isValidDate(date) || !description || description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error('A service record has invalid details.');
    }
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
      throw new Error('A service record has an invalid cost.');
    }
    return { id, date, description, amount: Math.round(amount * 100) / 100, createdAt };
  });
  return normalized.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function loadServiceHistory() {
  try {
    return normalizeServiceHistory(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch (_) {
    return [];
  }
}

export function saveServiceHistory(records) {
  const normalized = normalizeServiceHistory(records);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function createServiceRecord({ date, description, amount }) {
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return normalizeServiceHistory([{
    id,
    date,
    description,
    amount,
    createdAt: new Date().toISOString()
  }])[0];
}
