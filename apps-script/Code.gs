const XSWIFT_SHEET_ID = '1xxaLYpoQvzXhIzkHllMToVo-SKeM4TKNik7kqDbKID4';
const XSWIFT_TAB_NAME = 'รถยนต์';
const XSWIFT_SERVICE_HISTORY_TAB_NAME = 'ประวัติบำรุงรักษา';
const XSWIFT_MAX_SERVICE_RECORDS = 500;
const XSWIFT_MAX_SERVICE_ITEMS = 50;
const XSWIFT_MAX_SERVICE_DESCRIPTION_LENGTH = 500;
const XSWIFT_SESSION_MS = 12 * 60 * 60 * 1000;
const XSWIFT_PIN_ITERATIONS = 5000;
const XSWIFT_MAX_REQUEST_BYTES = 1800000;
const XSWIFT_MAX_IMAGE_BYTES = 1100000;
const XSWIFT_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const XSWIFT_FIELDS = [
  'model', 'plate', 'price', 'taxRenew', 'taxExpire', 'insType', 'insYear',
  'insExpire', 'licenseExpire', 'batteryDate', 'maintenanceDate',
  'maintenanceIntervalMonths', 'installmentsPaid', 'memo', 'carImageFileId', 'licenseImageFileId',
  'fuelLimit', 'fuelSpent'
];
const XSWIFT_IMAGE_FIELDS = ['carImageFileId', 'licenseImageFileId'];

/** Run once from the spreadsheet-bound Apps Script editor to create the private app PIN. */
function setupXswift() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active || active.getId() !== XSWIFT_SHEET_ID) {
    throw new Error('Open Apps Script from the Xswift spreadsheet using Extensions > Apps Script.');
  }
  const ui = SpreadsheetApp.getUi();
  const existing = PropertiesService.getScriptProperties().getProperty('XSWIFT_SETUP_COMPLETE');
  if (existing === 'true' && ui.alert('Reset Xswift PIN?', 'This replaces the current PIN and invalidates all active app sessions.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  const pin = generatePin_();
  const salt = Utilities.getUuid() + Utilities.getUuid();
  const properties = {
    XSWIFT_SPREADSHEET_ID: XSWIFT_SHEET_ID,
    XSWIFT_PIN_SALT: salt,
    XSWIFT_PIN_HASH: derivePinHash_(pin, salt),
    XSWIFT_SESSION_SECRET: Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid(),
    XSWIFT_SETUP_COMPLETE: 'true'
  };
  PropertiesService.getScriptProperties().setProperties(properties, true);
  ui.alert('Your Xswift PIN', 'Write this PIN down. It will not be shown again:\n\n' + pin, ui.ButtonSet.OK);
}

function doGet() {
  return json_({ ok: false, error: { code: 'POST_REQUIRED', message: 'Use the Xswift app.' } });
}

function doPost(event) {
  try {
    if (!event || !event.postData || Number(event.postData.length || 0) > XSWIFT_MAX_REQUEST_BYTES) {
      throw apiError_('REQUEST_TOO_LARGE', 'Request is too large.');
    }
    const params = event.parameter || {};
    const action = String(params.action || '');
    if (action === 'login') return handleLogin_(String(params.pin || ''));

    const session = verifySession_(String(params.sessionToken || ''));
    const payload = parsePayload_(params.payload || '{}');
    switch (action) {
      case 'getCar': return json_({ ok: true, record: loadCarRecord_() });
      case 'saveCar': return json_({ ok: true, record: saveCarRecord_(payload.record || payload) });
      case 'getServiceHistory': return json_({ ok: true, records: loadServiceHistory_() });
      case 'saveServiceHistory': return json_({ ok: true, records: saveServiceHistory_(payload.records) });
      case 'uploadImage': return json_({ ok: true, fileId: uploadImage_(payload) });
      case 'getImage': return json_({ ok: true, image: loadImage_(String(payload.fileId || '')) });
      default: throw apiError_('UNKNOWN_ACTION', 'This action is not available.');
    }
  } catch (error) {
    const apiError = error && error.apiCode ? error : apiError_('BACKEND_ERROR', 'Xswift could not complete this request.');
    return json_({ ok: false, error: { code: apiError.apiCode, message: apiError.message } });
  }
}

function handleLogin_(candidate) {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('XSWIFT_SETUP_COMPLETE') !== 'true') {
    throw apiError_('SETUP_REQUIRED', 'The Xswift backend has not been configured by its owner.');
  }
  if (!/^\d{6}$/.test(candidate)) throw apiError_('INVALID_PIN', 'PIN was not accepted. Try again later.');

  const cache = CacheService.getScriptCache();
  if (cache.get('xswift-pin-lock') === '1') throw apiError_('PIN_COOLDOWN', 'PIN was not accepted. Try again later.');
  const pinHash = derivePinHash_(candidate, properties.getProperty('XSWIFT_PIN_SALT'));
  if (!constantTimeEqual_(pinHash, properties.getProperty('XSWIFT_PIN_HASH') || '')) {
    const failed = Number(cache.get('xswift-pin-failures') || 0) + 1;
    if (failed >= 8) {
      cache.put('xswift-pin-lock', '1', 600);
      cache.remove('xswift-pin-failures');
    } else {
      cache.put('xswift-pin-failures', String(failed), 600);
    }
    throw apiError_('INVALID_PIN', 'PIN was not accepted. Try again later.');
  }

  cache.remove('xswift-pin-failures');
  cache.remove('xswift-pin-lock');
  const now = Date.now();
  const token = signSession_({ version: 1, issuedAt: now, expiresAt: now + XSWIFT_SESSION_MS, nonce: Utilities.getUuid() });
  return json_({ ok: true, token: token, expiresAt: now + XSWIFT_SESSION_MS });
}

function verifySession_(token) {
  const parts = token.split('.');
  if (parts.length !== 2) throw apiError_('SESSION_EXPIRED', 'Enter your PIN again.');
  const expected = sign_(parts[0], PropertiesService.getScriptProperties().getProperty('XSWIFT_SESSION_SECRET') || '');
  if (!constantTimeEqual_(expected, parts[1])) throw apiError_('SESSION_EXPIRED', 'Enter your PIN again.');
  let claims;
  try { claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); }
  catch (_) { throw apiError_('SESSION_EXPIRED', 'Enter your PIN again.'); }
  if (claims.version !== 1 || !Number.isFinite(claims.expiresAt) || claims.expiresAt <= Date.now()) {
    throw apiError_('SESSION_EXPIRED', 'Enter your PIN again.');
  }
  return claims;
}

function signSession_(claims) {
  const encoded = Utilities.base64EncodeWebSafe(JSON.stringify(claims)).replace(/=+$/, '');
  const secret = PropertiesService.getScriptProperties().getProperty('XSWIFT_SESSION_SECRET') || '';
  return encoded + '.' + sign_(encoded, secret);
}

function sign_(message, secret) {
  if (!secret) throw apiError_('SETUP_REQUIRED', 'The Xswift backend has not been configured by its owner.');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(message, secret)).replace(/=+$/, '');
}

function derivePinHash_(pin, salt) {
  let result = salt + ':' + pin;
  for (let i = 0; i < XSWIFT_PIN_ITERATIONS; i++) {
    result = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(result, salt)).replace(/=+$/, '');
  }
  return result;
}

function constantTimeEqual_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let difference = a.length ^ b.length;
  const size = Math.max(a.length, b.length);
  for (let i = 0; i < size; i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}

function loadCarRecord_() {
  const sheet = getCarSheet_();
  const values = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 2).getDisplayValues();
  const record = Object.fromEntries(XSWIFT_FIELDS.map(field => [field, '']));
  for (const row of values.slice(1)) {
    const key = String(row[0] || '');
    if (XSWIFT_FIELDS.indexOf(key) !== -1) record[key] = String(row[1] || '');
  }
  return record;
}

function loadServiceHistory_() {
  const sheet = getServiceHistorySheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getDisplayValues()
    .filter(row => row.some(value => value !== ''))
    .map(row => ({ id: row[0], date: row[1], items: parseServiceItems_(unescapeSheetText_(row[2]), Number(row[3])), amount: Number(row[3]), createdAt: row[4] }));
}

function saveServiceHistory_(input) {
  if (!Array.isArray(input) || input.length > XSWIFT_MAX_SERVICE_RECORDS) {
    throw apiError_('INVALID_DATA', 'Service history must contain no more than 500 records.');
  }
  const normalized = input.map(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw apiError_('INVALID_DATA', 'A service record is invalid.');
    const id = String(record.id || '').trim();
    const date = String(record.date || '').trim();
    const legacyDescription = String(record.description || '').trim();
    const legacyAmount = Number(record.amount);
    const items = Array.isArray(record.items) ? record.items : (legacyDescription && Number.isFinite(legacyAmount) ? [{ description: legacyDescription, quantity: 1, unitPrice: legacyAmount }] : null);
    const createdAt = String(record.createdAt || '');
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || !isValidServiceDate_(date) || !Array.isArray(items) || !items.length || items.length > XSWIFT_MAX_SERVICE_ITEMS) {
      throw apiError_('INVALID_DATA', 'A service record has invalid details.');
    }
    const cleanItems = items.map(item => {
      const description = String(item.description || '').trim();
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      if (!description || description.length > XSWIFT_MAX_SERVICE_DESCRIPTION_LENGTH || /[\u0000-\u001f\u007f]/.test(description) || !Number.isInteger(quantity) || quantity < 1 || quantity > 999 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000000) {
        throw apiError_('INVALID_DATA', 'A service receipt item has invalid details.');
      }
      return { description: description, quantity: quantity, unitPrice: Math.round(unitPrice * 100) / 100, amount: Math.round(quantity * unitPrice * 100) / 100 };
    });
    const amount = Math.round(cleanItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    if (!Number.isFinite(amount) || amount > 100000000) throw apiError_('INVALID_DATA', 'A service receipt total is invalid.');
    return { id: id, date: date, items: cleanItems, amount: amount, createdAt: createdAt };
  });
  if (normalized.some(record => JSON.stringify(record.items).length > 45000) || JSON.stringify(normalized).length > 450000) throw apiError_('INVALID_DATA', 'Service history is too large to save.');
  const records = normalized.map(record => [record.id, record.date, safeSheetText_(JSON.stringify(record.items)), String(record.amount), record.createdAt]);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getServiceHistorySheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 5).clearContent();
    if (records.length) {
      const range = sheet.getRange(2, 1, records.length, 5);
      range.setNumberFormat('@');
      range.setValues(records);
    }
  } finally {
    lock.releaseLock();
  }
  return normalized;
}

function parseServiceItems_(value, legacyAmount) {
  try {
    const items = JSON.parse(value);
    if (Array.isArray(items) && items.length) return items;
  } catch (_) {}
  return [{ description: value, quantity: 1, unitPrice: legacyAmount, amount: legacyAmount }];
}

function getServiceHistorySheet_() {
  const spreadsheet = SpreadsheetApp.openById(XSWIFT_SHEET_ID);
  let sheet = spreadsheet.getSheetByName(XSWIFT_SERVICE_HISTORY_TAB_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(XSWIFT_SERVICE_HISTORY_TAB_NAME);
    sheet.getRange(1, 1, 1, 5).setValues([['id', 'date', 'description', 'amount', 'createdAt']]);
  }
  const header = sheet.getRange(1, 1, 1, 5).getDisplayValues()[0];
  const expected = ['id', 'date', 'description', 'amount', 'createdAt'];
  if (expected.some((value, index) => header[index] !== value)) {
    throw apiError_('SHEET_FORMAT', 'The service history sheet has an unexpected format and was not changed.');
  }
  return sheet;
}

function isValidServiceDate_(date) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) return false;
  const parsed = new Date(date + 'T00:00:00Z');
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function safeSheetText_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function unescapeSheetText_(value) {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

function saveCarRecord_(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw apiError_('INVALID_DATA', 'Vehicle data is invalid.');
  const unknown = Object.keys(input).filter(key => XSWIFT_FIELDS.indexOf(key) === -1);
  if (unknown.length) throw apiError_('INVALID_FIELD', 'Vehicle data contains an unsupported field.');
  const sheet = getCarSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const existing = loadCarRecord_();
    const next = Object.assign({}, existing);
    for (const key of Object.keys(input)) {
      if (typeof input[key] !== 'string' && typeof input[key] !== 'number') throw apiError_('INVALID_DATA', 'Vehicle data is invalid.');
      const value = String(input[key]);
      if (value.length > (key === 'memo' ? 10000 : 500)) throw apiError_('INVALID_DATA', 'A vehicle field is too long.');
      next[key] = value;
    }
    assertImageReferences_(existing, next);

    const rows = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 2).getDisplayValues();
    const firstRowByKey = new Map();
    rows.slice(1).forEach((row, index) => {
      const key = String(row[0] || '');
      if (XSWIFT_FIELDS.indexOf(key) !== -1 && !firstRowByKey.has(key)) firstRowByKey.set(key, index + 2);
    });
    const missing = [];
    for (const field of XSWIFT_FIELDS) {
      const row = firstRowByKey.get(field);
      if (row) sheet.getRange(row, 2).setNumberFormat('@').setValue(next[field]);
      else missing.push([field, next[field]]);
    }
    if (missing.length) {
      const start = Math.max(sheet.getLastRow() + 1, 2);
      const range = sheet.getRange(start, 1, missing.length, 2);
      range.setNumberFormat('@');
      range.setValues(missing);
    }
    return next;
  } finally {
    lock.releaseLock();
  }
}

function assertImageReferences_(existing, next) {
  const owned = loadOwnedImageIds_();
  for (const field of XSWIFT_IMAGE_FIELDS) {
    const fileId = String(next[field] || '');
    if (fileId && fileId !== String(existing[field] || '') && !owned.has(fileId)) {
      throw apiError_('INVALID_IMAGE', 'Only Xswift vehicle photos can be selected.');
    }
  }
}

function uploadImage_(payload) {
  const mimeType = String(payload.mimeType || '');
  const encoded = String(payload.data || '');
  if (XSWIFT_ALLOWED_MIME.indexOf(mimeType) === -1 || !encoded || encoded.length > Math.ceil(XSWIFT_MAX_IMAGE_BYTES * 4 / 3) + 16) {
    throw apiError_('INVALID_IMAGE', 'Choose a supported photo smaller than 1.1 MB.');
  }
  let bytes;
  try { bytes = Utilities.base64Decode(encoded); }
  catch (_) { throw apiError_('INVALID_IMAGE', 'Photo data is invalid.'); }
  if (!bytes.length || bytes.length > XSWIFT_MAX_IMAGE_BYTES) throw apiError_('INVALID_IMAGE', 'Choose a supported photo smaller than 1.1 MB.');

  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const blob = Utilities.newBlob(bytes, mimeType, 'xswift-' + Date.now() + '.' + extension);
  const file = DriveApp.createFile(blob);
  rememberOwnedImageId_(file.getId());
  return file.getId();
}

function loadImage_(fileId) {
  const record = loadCarRecord_();
  if (!fileId || !new Set(XSWIFT_IMAGE_FIELDS.map(key => record[key])).has(fileId)) {
    throw apiError_('INVALID_IMAGE', 'This photo is not linked to the vehicle.');
  }
  const blob = DriveApp.getFileById(fileId).getBlob();
  const mimeType = blob.getContentType();
  if (XSWIFT_ALLOWED_MIME.indexOf(mimeType) === -1) throw apiError_('INVALID_IMAGE', 'This photo format is not supported.');
  return { mimeType: mimeType, data: Utilities.base64Encode(blob.getBytes()) };
}

function rememberOwnedImageId_(fileId) {
  const properties = PropertiesService.getScriptProperties();
  let ids = [];
  try { ids = JSON.parse(properties.getProperty('XSWIFT_OWNED_IMAGE_IDS') || '[]'); } catch (_) {}
  ids = ids.filter(id => typeof id === 'string' && id !== fileId).slice(-99);
  ids.push(fileId);
  properties.setProperty('XSWIFT_OWNED_IMAGE_IDS', JSON.stringify(ids));
}

function loadOwnedImageIds_() {
  try { return new Set(JSON.parse(PropertiesService.getScriptProperties().getProperty('XSWIFT_OWNED_IMAGE_IDS') || '[]')); }
  catch (_) { return new Set(); }
}

function getCarSheet_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty('XSWIFT_SPREADSHEET_ID');
  if (properties.getProperty('XSWIFT_SETUP_COMPLETE') !== 'true' || spreadsheetId !== XSWIFT_SHEET_ID) {
    throw apiError_('SETUP_REQUIRED', 'The Xswift backend has not been configured by its owner.');
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(XSWIFT_TAB_NAME);
  if (!sheet) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try { sheet = spreadsheet.getSheetByName(XSWIFT_TAB_NAME) || spreadsheet.insertSheet(XSWIFT_TAB_NAME); }
    finally { lock.releaseLock(); }
  }
  if (sheet.getLastRow() === 0) {
    const rows = [['key', 'value'], ...XSWIFT_FIELDS.map(key => [key, ''])];
    const range = sheet.getRange(1, 1, rows.length, 2);
    range.setNumberFormat('@');
    range.setValues(rows);
  } else {
    const header = sheet.getRange(1, 1, 1, 2).getDisplayValues()[0];
    if (header[0] !== 'key' || header[1] !== 'value') throw apiError_('SHEET_FORMAT', 'The vehicle sheet has an unexpected format and was not changed.');
  }
  return sheet;
}

function parsePayload_(value) {
  try {
    const result = JSON.parse(value);
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('invalid');
    return result;
  } catch (_) {
    throw apiError_('INVALID_REQUEST', 'Request data is invalid.');
  }
}

function generatePin_() {
  const hex = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  return hex.slice(0, 6).split('').map(character => String(parseInt(character, 16) % 10)).join('');
}

function apiError_(code, message) {
  const error = new Error(message);
  error.apiCode = code;
  return error;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

