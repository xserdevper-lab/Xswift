const FORM_FIELDS = {
  model: 'ce-model', plate: 'ce-plate', price: 'ce-price', taxRenew: 'ce-tax-renew',
  taxExpire: 'ce-tax-expire', insType: 'ce-ins-type', insYear: 'ce-ins-year',
  insExpire: 'ce-ins-expire', licenseExpire: 'ce-license-expire'
};

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function documentStatus(value) {
  if (!value) return { text: 'ยังไม่ระบุ', tone: '' };
  const expiry = new Date(`${value}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return { text: '—', tone: '' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiry - today) / 86400000);
  if (days < 0) return { text: `หมดอายุแล้ว ${Math.abs(days)} วัน`, tone: 'bad' };
  if (days <= 30) return { text: `เหลือ ${days} วัน`, tone: 'warn' };
  return { text: `เหลือ ${days} วัน`, tone: 'good' };
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
  put('car-model-text', record.model || 'ยังไม่ได้ตั้งค่ารถ');
  put('car-plate-text', record.plate || 'ทะเบียนรถ');
  put('car-plate-badge', record.plate || '—');
  const price = Number(record.price || 0);
  put('car-price-val', `฿${price.toLocaleString('th-TH')}`);
  put('car-tax-renew', `วันต่อ: ${formatDate(record.taxRenew)}`);
  put('car-tax-expire', formatDate(record.taxExpire));
  put('car-ins-type', record.insType ? `${record.insType}${record.insYear ? ` ปี ${record.insYear}` : ''}` : '—');
  put('car-ins-expire', formatDate(record.insExpire));
  put('car-license-expire', formatDate(record.licenseExpire));
  putStatus('car-tax-status', record.taxExpire);
  putStatus('car-ins-status', record.insExpire);
  putStatus('car-license-status', record.licenseExpire);
  document.getElementById('car-memo').value = record.memo || '';
  for (const [field, id] of Object.entries(FORM_FIELDS)) {
    document.getElementById(id).value = record[field] ?? '';
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
  document.getElementById('sign-in-button').hidden = connected;
  document.getElementById('sign-out-button').hidden = !connected;
  document.getElementById('connect-button').hidden = connected;
}

export function setCarFormEnabled(enabled) {
  document.getElementById('car-memo').disabled = !enabled;
  for (const id of ['edit-car-button', 'save-memo-button', 'car-photo-button', 'license-photo-button']) {
    document.getElementById(id).disabled = !enabled;
  }
}
