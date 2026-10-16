import { getLanguageLocale, t } from './i18n.js?v=4';

const FORM_FIELDS = {
  model: 'ce-model', plate: 'ce-plate', price: 'ce-price', taxRenew: 'ce-tax-renew',
  taxExpire: 'ce-tax-expire', insType: 'ce-ins-type', insYear: 'ce-ins-year',
  insExpire: 'ce-ins-expire', licenseExpire: 'ce-license-expire', batteryDate: 'ce-battery-date',
  maintenanceDate: 'ce-maintenance-date', maintenanceIntervalMonths: 'ce-maintenance-interval',
  installmentsPaid: 'ce-installments-paid'
};
const TOTAL_INSTALLMENTS = 72;

const INSURANCE_TYPES = new Map([
  ['ชั้น 1', 'Class 1'], ['ชั้น 2', 'Class 2'], ['ชั้น 2+', 'Class 2+'],
  ['ชั้น 3', 'Class 3'], ['ชั้น 3+', 'Class 3+']
]);

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(getLanguageLocale(), { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatMaintenanceMonth(date) {
  return new Intl.DateTimeFormat(getLanguageLocale(), {month:'long',year:'numeric'}).format(date);
}

function dateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addMonths(date, months) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function wholeMonthsBetween(start, end) {
  const calendarMonths = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  return calendarMonths - (end.getDate() < start.getDate() ? 1 : 0);
}

function documentStatus(value) {
  if (!value) return { text: t('Not set'), tone: '' };
  const expiry = new Date(`${value}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return { text: '—', tone: '' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiry - today) / 86400000);
  if (days < 0) return { text: t('Expired {days} days ago', { days: Math.abs(days) }), tone: 'bad' };
  if (days === 0) return { text: t('Expires today'), tone: 'warn' };
  if (days === 1) return { text: t('1 day left'), tone: 'warn' };
  if (days <= 30) return { text: t('{days} days left', { days }), tone: 'warn' };
  return { text: t('{days} days left', { days }), tone: 'good' };
}

function put(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value ?? '';
}

function putStatus(id, date) {
  const element = document.getElementById(id);
  const status = documentStatus(date);
  element.textContent = status.text;
  element.dataset.tone = status.tone;
}

export function renderCar(record = {}) {
  put('car-model-text', record.model || t('Vehicle not set up'));
  put('car-plate-text', record.plate || t('License plate'));
  const price = Number(record.price || 0);
  put('car-price-val', `฿${price.toLocaleString('en-US')}`);
  const rawInstallmentsPaid = Number(record.installmentsPaid);
  const installmentsPaid = Number.isFinite(rawInstallmentsPaid)
    ? Math.max(0, Math.min(TOTAL_INSTALLMENTS, Math.floor(rawInstallmentsPaid)))
    : 0;
  const installmentPercent = Math.round((installmentsPaid / TOTAL_INSTALLMENTS) * 100);
  const installmentsRemaining = TOTAL_INSTALLMENTS - installmentsPaid;
  const yearsRemaining = Math.floor(installmentsRemaining / 12);
  const monthsRemaining = installmentsRemaining % 12;
  put('installment-progress-percent', `${installmentPercent}%`);
  put('installment-paid-count', t('{paid} of {total} installments paid', { paid: installmentsPaid, total: TOTAL_INSTALLMENTS }));
  put('installment-remaining-count', t('{count} installments remaining', { count: installmentsRemaining }));
  let remainingDuration;
  if (installmentsRemaining === 0) {
    remainingDuration = t('All installments paid');
  } else if (yearsRemaining && monthsRemaining) {
    remainingDuration = t('{years} {yearUnit} {months} {monthUnit}', {
      years: yearsRemaining,
      yearUnit: t(yearsRemaining === 1 ? 'year' : 'years'),
      months: monthsRemaining,
      monthUnit: t(monthsRemaining === 1 ? 'month' : 'months')
    });
  } else if (yearsRemaining) {
    remainingDuration = t('{count} {unit}', { count: yearsRemaining, unit: t(yearsRemaining === 1 ? 'year' : 'years') });
  } else {
    remainingDuration = t('{count} {unit}', { count: monthsRemaining, unit: t(monthsRemaining === 1 ? 'month' : 'months') });
  }
  put('installment-time-remaining', remainingDuration);
  const installmentProgress = document.getElementById('installment-progress');
  const installmentProgressFill = document.getElementById('installment-progress-fill');
  if (installmentProgress) installmentProgress.setAttribute('aria-valuenow', String(installmentsPaid));
  if (installmentProgressFill) installmentProgressFill.style.width = `${installmentPercent}%`;
  const fuelLimit = Math.max(1, Number(record.fuelLimit) || 5000);
  const fuelSpent = Math.max(0, Number(record.fuelSpent) || 0);
  const fuelUsedPercent = Math.round((fuelSpent / fuelLimit) * 100);
  const fuelProgressPercent = Math.min(100, fuelUsedPercent);
  const formatBaht = value => `฿${Math.round(value).toLocaleString('en-US')}`;
  put('fuel-limit-display', fuelLimit.toLocaleString('en-US'));
  put('fuel-limit-scale', formatBaht(fuelLimit));
  put('fuel-progress-center', formatBaht(fuelSpent));
  put('fuel-spent-display', `${formatBaht(fuelSpent)} ${t('spent')}`);
  put('fuel-used-percent', `${fuelUsedPercent}%`);
  const fuelProgressFill = document.getElementById('fuel-progress-fill');
  if (fuelProgressFill) fuelProgressFill.style.width = `${fuelProgressPercent}%`;
  document.getElementById('fuel-progress').setAttribute('aria-valuenow', String(fuelProgressPercent));
  document.getElementById('fuel-limit-input').value = String(fuelLimit);
  const maintenanceProgressFill = document.getElementById('maintenance-progress-fill');
  const maintenanceProgress = document.getElementById('maintenance-progress');
  const maintenanceDate = record.maintenanceDate ? new Date(`${record.maintenanceDate.slice(0,7)}-01T00:00:00`) : null;
  const maintenanceIntervalMonths = Math.floor(Number(record.maintenanceIntervalMonths || 6));
  const hasMaintenanceSchedule = maintenanceDate && !Number.isNaN(maintenanceDate.getTime()) && maintenanceIntervalMonths > 0;
  put('maintenance-last-date', `${t('Last service:')} ${hasMaintenanceSchedule ? formatMaintenanceMonth(maintenanceDate) : '—'}`);
  put('maintenance-interval', `${t('Every')} ${hasMaintenanceSchedule ? maintenanceIntervalMonths : '—'} ${t('months')}`);
  if (hasMaintenanceSchedule) {
    const nextMaintenanceDate = addMonths(maintenanceDate, maintenanceIntervalMonths);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthDifference = (nextMaintenanceDate.getFullYear() - today.getFullYear()) * 12 + nextMaintenanceDate.getMonth() - today.getMonth();
    const remainingMonths = monthDifference;
    const daysRemaining = monthDifference < 0 ? -1 : 1;
    const elapsed = Math.max(0, Math.min(100, ((today - maintenanceDate) / (nextMaintenanceDate - maintenanceDate)) * 100));
    let maintenanceStatus;
    if (daysRemaining < 0) {
      const overdueMonths = Math.abs(monthDifference);
      maintenanceStatus = overdueMonths ? t('Overdue by {count} {unit}', { count: overdueMonths, unit: t(overdueMonths === 1 ? 'month' : 'months') }) : t('Overdue this month');
    } else if (remainingMonths > 0) {
      maintenanceStatus = t('{count} {unit} left', { count: remainingMonths, unit: t(remainingMonths === 1 ? 'month' : 'months') });
    } else if (nextMaintenanceDate.getFullYear() === today.getFullYear() && nextMaintenanceDate.getMonth() === today.getMonth()) {
      maintenanceStatus = t('Due this month');
    } else {
      maintenanceStatus = t('Due in less than 1 month');
    }
    put('maintenance-status', maintenanceStatus);
    put('maintenance-next-date', `${t('Next service:')} ${formatMaintenanceMonth(nextMaintenanceDate)}`);
    if (maintenanceProgressFill) maintenanceProgressFill.style.width = `${elapsed}%`;
    if (maintenanceProgress) maintenanceProgress.setAttribute('aria-valuenow', String(Math.round(elapsed)));
  } else {
    put('maintenance-status', t('Not set'));
    put('maintenance-next-date', t('Set in Edit details'));
    if (maintenanceProgressFill) maintenanceProgressFill.style.width = '0%';
    if (maintenanceProgress) maintenanceProgress.setAttribute('aria-valuenow', '0');
  }
  put('car-tax-renew', `${t('Renewal:')} ${formatDate(record.taxRenew)}`);
  put('car-tax-expire', formatDate(record.taxExpire));
  const insuranceType = INSURANCE_TYPES.get(record.insType) || record.insType;
  put('car-ins-type', insuranceType ? `${insuranceType}${record.insYear ? ` · ${record.insYear}` : ''}` : '—');
  put('car-ins-expire', formatDate(record.insExpire));
  put('car-license-expire', formatDate(record.licenseExpire));
  put('car-battery-date', formatDate(record.batteryDate));
  putStatus('car-tax-status', record.taxExpire);
  putStatus('car-ins-status', record.insExpire);
  putStatus('car-license-status', record.licenseExpire);
  document.getElementById('car-memo').value = record.memo || '';
  for (const [field, id] of Object.entries(FORM_FIELDS)) {
    const input = document.getElementById(id);
    if (!input) continue;
    input.value = field === 'insType'
      ? (INSURANCE_TYPES.get(record[field]) || record[field] || '')
      : field === 'maintenanceDate' ? String(record[field] || '').slice(0,7)
      : field === 'maintenanceIntervalMonths' ? String(record[field] || 6)
      : field === 'installmentsPaid' ? String(installmentsPaid)
      : record[field] ?? '';
  }
}

export function readCarForm() {
  return Object.fromEntries(Object.entries(FORM_FIELDS).flatMap(([field, id]) => {
    const input = document.getElementById(id);
    if (!input) return [];
    if (field === 'installmentsPaid') {
      const paid = Number(input.value);
      return [[field, String(Number.isFinite(paid) ? Math.max(0, Math.min(TOTAL_INSTALLMENTS, Math.floor(paid))) : 0)]];
    }
    return [[field, field === 'maintenanceDate' && input.value ? input.value + '-01' : input.value.trim()]];
  }));
}

export function setPhotoPreview(id, placeholderId, source) {
  const image = document.getElementById(id);
  const placeholder = document.getElementById(placeholderId);
  if (image.dataset.objectUrl) URL.revokeObjectURL(image.dataset.objectUrl);
  image.dataset.objectUrl = source || '';
  if (source) {
    image.src = source;
    image.hidden = false;
    placeholder.hidden = true;
  } else {
    image.removeAttribute('src');
    image.hidden = true;
    placeholder.hidden = false;
  }
}

export function setSyncState(state, message) {
  const status = document.getElementById('sync-status');
  if (status) {
    status.dataset.state = state;
    status.textContent = t(message);
  }
  const content = document.getElementById('car-content');
  if (state === 'connected') content.dataset.connected = 'true';
  if (state === 'disconnected') content.dataset.connected = 'false';
  const connected = content.dataset.connected === 'true';
  const panel = document.getElementById('connection-panel');
  if (panel) panel.hidden = connected;
  content.hidden = !connected;
  const signOutButton = document.getElementById('sign-out-button');
  if (signOutButton) signOutButton.hidden = !connected;
  const accountStatus = document.getElementById('settings-account-status');
  if (accountStatus) accountStatus.textContent = t(connected ? 'Session active in this tab' : 'No active session');
}

export function setCarFormEnabled(enabled) {
  document.getElementById('car-memo').disabled = !enabled;
  for (const id of ['edit-car-button', 'save-memo-button']) {
    const control = document.getElementById(id);
    if (control) control.disabled = !enabled;
  }
  for (const id of ['fuel-amount-input', 'fuel-add-button', 'fuel-limit-input', 'save-fuel-limit-button', 'reset-fuel-usage-button', 'ce-maintenance-date', 'ce-maintenance-interval', 'ce-installments-paid', 'decrease-installments', 'increase-installments']) {
    const control = document.getElementById(id);
    if (control) control.disabled = !enabled;
  }
}
