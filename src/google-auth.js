const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
].join(' ');

let tokenClient;
let currentToken = '';
let tokenExpiresAt = 0;
let pendingRequest;

function waitForGoogleIdentity(timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const poll = () => {
      if (window.google?.accounts?.oauth2) return resolve(window.google.accounts.oauth2);
      if (Date.now() - startedAt > timeoutMs) return reject(new Error('โหลดระบบลงชื่อเข้าใช้ Google ไม่สำเร็จ กรุณาลองใหม่'));
      window.setTimeout(poll, 100);
    };
    poll();
  });
}

export async function initializeGoogleAuth(clientId) {
  if (!clientId || clientId.startsWith('YOUR_')) throw new Error('กรุณาตั้งค่า Google OAuth Client ID ในไฟล์ config.js');
  const oauth2 = await waitForGoogleIdentity();
  tokenClient = oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: response => {
      const request = pendingRequest;
      pendingRequest = null;
      if (!request) return;
      if (response.error || !response.access_token) {
        currentToken = '';
        tokenExpiresAt = 0;
        request.reject(new Error(response.error_description || 'เชื่อมต่อบัญชี Google ไม่สำเร็จ'));
        return;
      }
      currentToken = response.access_token;
      tokenExpiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000;
      request.resolve(currentToken);
    },
    error_callback: error => {
      const request = pendingRequest;
      pendingRequest = null;
      if (request) request.reject(new Error(error?.message || 'กรุณาอนุญาตการเชื่อมต่อ Google'));
    }
  });
}

export function requestAccessToken() {
  if (!tokenClient) return Promise.reject(new Error('ระบบลงชื่อเข้าใช้ Google ยังไม่พร้อม'));
  if (pendingRequest) return pendingRequest.promise;

  let resolveRequest;
  let rejectRequest;
  const promise = new Promise((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = reject;
  });
  pendingRequest = { promise, resolve: resolveRequest, reject: rejectRequest };
  tokenClient.requestAccessToken({ prompt: '' });
  return promise;
}

export function getAccessToken() {
  if (!currentToken || Date.now() >= tokenExpiresAt) {
    currentToken = '';
    tokenExpiresAt = 0;
    throw new Error('เซสชัน Google หมดอายุ กรุณาเชื่อมต่ออีกครั้ง');
  }
  return currentToken;
}

export function signOut() {
  if (currentToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(currentToken, () => {});
  }
  currentToken = '';
  tokenExpiresAt = 0;
}
