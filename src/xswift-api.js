const SESSION_KEY = 'xswift-session-v1';
const MAX_IMAGE_BYTES = 1100000;

export class XswiftApiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'XswiftApiError';
    this.code = code;
  }
}

function endpoint() {
  const url = String(window.XSWIFT_CONFIG?.appsScriptUrl || '').trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
    throw new XswiftApiError('SETUP_REQUIRED', 'The Apps Script backend URL is not configured yet.');
  }
  return url;
}

function readSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (!session?.token || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch (_) {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function restoreSession() {
  return Boolean(readSession());
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function hasSession() {
  return Boolean(readSession());
}

export function isSessionError(error) {
  return error?.code === 'SESSION_EXPIRED' || error?.code === 'INVALID_SESSION';
}

async function post(fields) {
  let response;
  try {
    response = await fetch(endpoint(), {
      method: 'POST',
      body: new URLSearchParams(fields),
      redirect: 'follow',
      cache: 'no-store'
    });
  } catch (_) {
    throw new XswiftApiError('NETWORK_ERROR', 'Could not reach the Xswift backend. Check your connection and try again.');
  }

  let result;
  try { result = await response.json(); }
  catch (_) { throw new XswiftApiError('BACKEND_RESPONSE', 'The Xswift backend returned an unreadable response.'); }
  if (!response.ok || !result?.ok) {
    const code = result?.error?.code || 'BACKEND_ERROR';
    const message = result?.error?.message || 'Xswift could not complete this request.';
    const error = new XswiftApiError(code, message);
    if (isSessionError(error)) clearSession();
    throw error;
  }
  return result;
}

export async function loginWithPin(pin) {
  if (!/^\d{6}$/.test(String(pin || ''))) throw new XswiftApiError('INVALID_PIN', 'Enter the 6-digit PIN shown during owner setup.');
  const result = await post({ action: 'login', pin: String(pin) });
  if (!result.token || !Number.isFinite(Number(result.expiresAt))) {
    throw new XswiftApiError('BACKEND_RESPONSE', 'The Xswift backend did not return a valid session.');
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: result.token, expiresAt: Number(result.expiresAt) }));
}

export function getSessionToken() {
  const session = readSession();
  if (!session) throw new XswiftApiError('SESSION_EXPIRED', 'Enter your PIN again.');
  return session.token;
}

export async function apiRequest(action, payload = {}) {
  const session = readSession();
  if (!session) throw new XswiftApiError('SESSION_EXPIRED', 'Enter your PIN again.');
  return post({ action, sessionToken: session.token, payload: JSON.stringify(payload) });
}

export async function getCar() {
  const result = await apiRequest('getCar');
  return result.record || {};
}

export async function saveCar(record) {
  const result = await apiRequest('saveCar', { record });
  return result.record || record;
}

export async function getServiceHistory() {
  const result = await apiRequest('getServiceHistory');
  return Array.isArray(result.records) ? result.records : [];
}

export async function saveServiceHistory(records) {
  const result = await apiRequest('saveServiceHistory', { records });
  return Array.isArray(result.records) ? result.records : records;
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new XswiftApiError('IMAGE_ERROR', 'Could not prepare this photo.')), 'image/jpeg', quality);
  });
}

async function compressImage(file) {
  if (!(file instanceof Blob) || !String(file.type).startsWith('image/')) {
    throw new XswiftApiError('INVALID_IMAGE', 'Choose an image file.');
  }
  if (file.size <= MAX_IMAGE_BYTES && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
  if (!window.createImageBitmap) throw new XswiftApiError('IMAGE_TOO_LARGE', 'Choose a JPEG, PNG, or WebP photo smaller than 1.1 MB.');

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.76, 0.66, 0.56, 0.46]) {
      const blob = await canvasBlob(canvas, quality);
      if (blob.size <= MAX_IMAGE_BYTES) return blob;
    }
    throw new XswiftApiError('IMAGE_TOO_LARGE', 'This photo is still too large after compression. Choose another photo.');
  } finally {
    bitmap.close?.();
  }
}

async function blobBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
  }
  return btoa(binary);
}

export async function uploadCarImage(file) {
  const image = await compressImage(file);
  const result = await apiRequest('uploadImage', { mimeType: image.type, data: await blobBase64(image) });
  if (!result.fileId) throw new XswiftApiError('BACKEND_RESPONSE', 'The uploaded photo did not return a file ID.');
  return { fileId: result.fileId };
}

export async function loadCarImage(fileId) {
  if (!fileId) return '';
  const result = await apiRequest('getImage', { fileId });
  const image = result.image;
  if (!image?.data || !['image/jpeg', 'image/png', 'image/webp'].includes(image.mimeType)) {
    throw new XswiftApiError('BACKEND_RESPONSE', 'The vehicle photo returned an invalid response.');
  }
  const binary = atob(image.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: image.mimeType }));
}

