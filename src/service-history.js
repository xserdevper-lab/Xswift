const STORAGE_KEY = 'xswift-service-history-v1';
const MAX_RECORDS = 500;
const MAX_ITEMS_PER_RECEIPT = 50;
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
    let items = Array.isArray(record?.items) ? record.items : null;
    if (!items) {
      const legacyDescription = String(record?.description || '').trim();
      const legacyAmount = Number(record?.amount);
      if (!legacyDescription || !Number.isFinite(legacyAmount)) throw new Error('A service record has invalid details.');
      items = [{ description: legacyDescription, quantity: 1, unitPrice: legacyAmount }];
    }
    if (!items.length || items.length > MAX_ITEMS_PER_RECEIPT) throw new Error('A receipt must contain between 1 and 50 items.');
    const normalizedItems = items.map(item => {
      const description = String(item?.description || '').trim();
      const quantity = Number(item?.quantity ?? 1);
      const unitPrice = Number(item?.unitPrice ?? item?.amount);
      if (!description || description.length > MAX_DESCRIPTION_LENGTH || /[\u0000-\u001f\u007f]/.test(description) || !Number.isInteger(quantity) || quantity < 1 || quantity > 999 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > MAX_AMOUNT) {
        throw new Error('A receipt item has invalid details.');
      }
      return { description, quantity, unitPrice: Math.round(unitPrice * 100) / 100, amount: Math.round(quantity * unitPrice * 100) / 100 };
    });
    const amount = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
    const createdAt = String(record?.createdAt || '');
    if (!/^[\w-]{1,80}$/.test(id) || !isValidDate(date)) {
      throw new Error('A service record has invalid details.');
    }
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
      throw new Error('A service record has an invalid cost.');
    }
    return { id, date, items: normalizedItems, amount: Math.round(amount * 100) / 100, createdAt };
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

export function createServiceRecord({ date, items }) {
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return normalizeServiceHistory([{
    id,
    date,
    items,
    createdAt: new Date().toISOString()
  }])[0];
}
