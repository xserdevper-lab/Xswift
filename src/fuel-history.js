const STORAGE_KEY = 'xswift-fuel-history-v1';
const MAX_RECORDS = 5000;
const MAX_AMOUNT = 100_000_000;

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeFuelHistory(records) {
  if (!Array.isArray(records) || records.length > MAX_RECORDS) throw new Error('Fuel history must contain no more than 5000 records.');
  const normalized = records.map(record => {
    const id = String(record?.id || '').trim();
    const date = String(record?.date || '').trim();
    const amount = Number(record?.amount);
    const createdAt = String(record?.createdAt || '');
    if (!/^[\w-]{1,80}$/.test(id) || !validDate(date) || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      throw new Error('A fuel record has invalid details.');
    }
    return { id, date, amount: Math.round(amount * 100) / 100, createdAt };
  });
  if (new Set(normalized.map(record => record.id)).size !== normalized.length) throw new Error('Fuel history contains duplicate records.');
  return normalized.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function loadFuelHistory() {
  try { return normalizeFuelHistory(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
  catch (_) { return []; }
}

export function saveFuelHistory(records) {
  const normalized = normalizeFuelHistory(records);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function createFuelRecord({ date, amount }) {
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return normalizeFuelHistory([{ id, date, amount, createdAt: new Date().toISOString() }])[0];
}

export function getFuelCycle(date) {
  const [year, month, day] = date.split('-').map(Number);
  const startMonth = day >= 25 ? month - 1 : month - 2;
  const start = new Date(Date.UTC(year, startMonth, 25));
  const end = new Date(Date.UTC(year, startMonth + 1, 24));
  const toISO = value => value.toISOString().slice(0, 10);
  return { start: toISO(start), end: toISO(end) };
}
