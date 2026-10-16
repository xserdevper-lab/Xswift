const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_WINDOW_DAYS = 3;

function toBangkokDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function nextMaintenanceDate(record) {
  const value = String(record.maintenanceDate || '');
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value);
  const rawInterval = Number(record.maintenanceIntervalMonths || 6);
  const interval = Math.floor(rawInterval);
  if (!match || !Number.isFinite(rawInterval) || interval < 1 || interval > 60) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const dueMonth = month - 1 + interval;
  const dueYear = year + Math.floor(dueMonth / 12);
  const dueMonthIndex = dueMonth % 12;
  return new Date(Date.UTC(dueYear, dueMonthIndex, 1));
}

function daysBetween(from, to) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function getUpcomingReminders(record = {}, today = new Date()) {
  const todayDate = parseDateKey(toBangkokDateKey(today));
  const dueDates = [
    ['tax', 'Road tax', parseDateKey(record.taxExpire)],
    ['insurance', 'Insurance', parseDateKey(record.insExpire)],
    ['license', "Driver's license", parseDateKey(record.licenseExpire)],
    ['maintenance', 'Service center maintenance', nextMaintenanceDate(record)]
  ];

  return dueDates.flatMap(([id, label, date]) => {
    if (!date) return [];
    const daysRemaining = daysBetween(todayDate, date);
    if (daysRemaining > REMINDER_WINDOW_DAYS) return [];
    return [{ id, label, date, daysRemaining }];
  }).sort((left, right) => left.daysRemaining - right.daysRemaining || left.label.localeCompare(right.label));
}

export function formatReminderDate(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  }).format(date);
}
