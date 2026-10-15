const FORM_FIELDS = {
  model: 'ce-model', plate: 'ce-plate', price: 'ce-price', taxRenew: 'ce-tax-renew',
  taxExpire: 'ce-tax-expire', insType: 'ce-ins-type', insYear: 'ce-ins-year',
  insExpire: 'ce-ins-expire', licenseExpire: 'ce-license-expire'
};

const INSURANCE_TYPES = new Map([
  ['ชั้น 1', 'Class 1'], ['ชั้น 2', 'Class 2'], ['ชั้น 2+', 'Class 2+'],
  ['ชั้น 3', 'Class 3'], ['ชั้น 3+', 'Class 3+']
]);

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function documentStatus(value) {
  if (!value) return { text: 'Not set', tone: '' };
  const expiry = new Date(`${value}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return { text: '—', tone: '' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiry - today) / 86400000);
  if (days < 0) return { text: `Expired ${Math.abs(days)} days ago`, tone: 'bad' };
  if (days === 0) return { text: 'Expires today', tone: 'warn' };
  if (days === 1) return { text: '1 day left', tone: 'warn' };
  if (days <= 30) return { text: `${days} days left`, tone: 'warn' };
  return { text: `${days} days left`, tone: 'good' };
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
  put('car-model-text', record.model || 'Vehicle not set up');
  put('car-plate-text', record.plate || 'License plate');
  const price = Number(record.price || 0);
  put('car-price-val', `฿${price.toLocaleString('en-US')}`);
  const fuelLimit = Math.max(1, Number(record.fuelLimit) || 5000);
  const fuelSpent = Math.max(0, Number(record.fuelSpent) || 0);
  const fuelUsedPercent = Math.round((fuelSpent / fuelLimit) * 100);
  const fuelProgressPercent = Math.min(100, fuelUsedPercent);
  const formatBaht = value => `฿${Math.round(value).toLocaleString('en-US')}`;
  put('fuel-limit-display', fuelLimit.toLocaleString('en-US'));
  put('fuel-limit-scale', formatBaht(fuelLimit));
  put('fuel-progress-center', formatBaht(fuelSpent));
  put('fuel-spent-display', `${formatBaht(fuelSpent)} spent`);
  put('fuel-used-percent', `${fuelUsedPercent}%`);
  document.getElementById('fuel-progress-fill').style.width = `${fuelProgressPercent}%`;
  document.getElementById('fuel-progress').setAttribute('aria-valuenow', String(fuelProgressPercent));
  document.getElementById('fuel-limit-input').value = String(fuelLimit);
  put('car-tax-renew', `Renewal: ${formatDate(record.taxRenew)}`);
  put('car-tax-expire', formatDate(record.taxExpire));
  const insuranceType = INSURANCE_TYPES.get(record.insType) || record.insType;
  put('car-ins-type', insuranceType ? `${insuranceType}${record.insYear ? ` · ${record.insYear}` : ''}` : '—');
  put('car-ins-expire', formatDate(record.insExpire));
  put('car-license-expire', formatDate(record.licenseExpire));
  putStatus('car-tax-status', record.taxExpire);
  putStatus('car-ins-status', record.insExpire);
  putStatus('car-license-status', record.licenseExpire);
  document.getElementById('car-memo').value = record.memo || '';
  for (const [field, id] of Object.entries(FORM_FIELDS)) {
    document.getElementById(id).value = field === 'insType'
      ? (INSURANCE_TYPES.get(record[field]) || record[field] || '')
      : record[field] ?? '';
  }
}

export function readCarForm() {
  return Object.fromEntries(Object.entries(FORM_FIELDS).map(([field, id]) => [field, document.getElementById(id).value.trim()]));
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
  status.dataset.state = state;
  status.textContent = message;
  if (state === 'connected') document.getElementById('car-content').dataset.connected = 'true';
  if (state === 'disconnected') document.getElementById('car-content').dataset.connected = 'false';
  const connected = document.getElementById('car-content').dataset.connected === 'true';
  const panel = document.getElementById('connection-panel');
  const content = document.getElementById('car-content');
  panel.hidden = connected;
  content.hidden = !connected;
  document.getElementById('sign-in-button').hidden = connected && state !== 'error';
  document.getElementById('sign-in-button').textContent = connected ? 'Reconnect Google' : 'Connect Google';
  document.getElementById('sign-out-button').hidden = !connected;
  document.getElementById('settings-account-status').textContent = connected ? 'Connected to Google Sheets and Drive' : 'Not connected';
  document.getElementById('settings-connect-button').hidden = connected;
  document.getElementById('connect-button').hidden = connected;
}

export function setCarFormEnabled(enabled) {
  document.getElementById('car-memo').disabled = !enabled;
  for (const id of ['edit-car-button', 'save-memo-button']) {
    document.getElementById(id).disabled = !enabled;
  }
  for (const id of ['fuel-amount-input', 'fuel-add-button', 'fuel-limit-input', 'save-fuel-limit-button']) {
    document.getElementById(id).disabled = !enabled;
  }
}


