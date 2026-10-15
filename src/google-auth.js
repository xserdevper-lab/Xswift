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
      if (Date.now() - startedAt > timeoutMs) return reject(new Error('Could not load Google sign-in. Please try again.'));
      window.setTimeout(poll, 100);
    };
    poll();
  });
}

export async function initializeGoogleAuth(clientId) {
  if (!clientId || clientId.startsWith('YOUR_')) throw new Error('Set the Google OAuth Client ID in config.js.');
  const oauth2 = await waitForGoogleIdentity();
  tokenClient = oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: response => {
      const request = pendingRequest;
      pendingRequest = null;
      if (!request) return;
      window.clearTimeout(request.timeout);
      if (response.error || !response.access_token) {
        currentToken = '';
        tokenExpiresAt = 0;
        request.reject(new Error(response.error_description || 'Could not connect to Google.'));
        return;
      }
      currentToken = response.access_token;
      tokenExpiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000;
      request.resolve(currentToken);
    },
    error_callback: error => {
      const request = pendingRequest;
      pendingRequest = null;
      if (request) window.clearTimeout(request.timeout);
      if (request) request.reject(new Error(error?.message || 'Please allow Google access.'));
    }
  });
}

export function requestAccessToken() {
  if (!tokenClient) return Promise.reject(new Error('Google sign-in is not ready yet.'));
  if (pendingRequest) return pendingRequest.promise;

  let resolveRequest;
  let rejectRequest;
  const promise = new Promise((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = reject;
  });
  pendingRequest = { promise, resolve: resolveRequest, reject: rejectRequest };
  pendingRequest.timeout = window.setTimeout(() => {
    const request = pendingRequest;
    pendingRequest = null;
    request?.reject(new Error('Google access was not granted. Press Connect and try again.'));
  }, 60000);
  try {
    tokenClient.requestAccessToken({ prompt: '' });
  } catch (error) {
    const request = pendingRequest;
    pendingRequest = null;
    if (request) {
      window.clearTimeout(request.timeout);
      request.reject(error);
    }
  }
  return promise;
}

export function refreshAccessTokenSilently() {
  if (!tokenClient) return Promise.reject(new Error('Google sign-in is not ready yet.'));
  if (pendingRequest) return pendingRequest.promise;

  let resolveRequest;
  let rejectRequest;
  const promise = new Promise((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = reject;
  });
  pendingRequest = { promise, resolve: resolveRequest, reject: rejectRequest };
  pendingRequest.timeout = window.setTimeout(() => {
    const request = pendingRequest;
    pendingRequest = null;
    request?.reject(new Error('Could not refresh the Google session.'));
  }, 15000);
  try {
    tokenClient.requestAccessToken({ prompt: 'none' });
  } catch (error) {
    const request = pendingRequest;
    pendingRequest = null;
    if (request) {
      window.clearTimeout(request.timeout);
      request.reject(error);
    }
  }
  return promise;
}

export function getAccessToken() {
  if (!currentToken || Date.now() >= tokenExpiresAt) {
    currentToken = '';
    tokenExpiresAt = 0;
    throw new Error('Your Google session expired. Please reconnect.');
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


