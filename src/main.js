import { initializeGoogleAuth, requestAccessToken, refreshAccessTokenSilently, getAccessToken, signOut } from './google-auth.js';
import { uploadCarImage } from './car-drive.js';
import { syncCar, saveSyncedCar } from './car-sync.js';
import { renderCar, readCarForm, setCarFormEnabled, setPhotoPreview, setSyncState } from './car-app.js';
import { parseLegacyCar } from './legacy-import.js';

const config = window.XSWIFT_CONFIG || {};
const state = { record: null, toastTimer: 0, installPrompt: null };
const $ = id => document.getElementById(id);

function toast(message) {
  const element = $('toast');
  element.textContent = message;
  element.classList.add('show');
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => element.classList.remove('show'), 2800);
}

function setBusy(busy) {
  const connected = Boolean(state.record);
  $('sign-in-button').disabled = busy || !requireConfig();
  $('connect-button').disabled = busy || !requireConfig();
  $('sign-out-button').disabled = busy || !connected;
  for (const id of ['edit-car-button', 'save-memo-button', 'save-car-button', 'fuel-amount-input', 'fuel-add-button', 'fuel-limit-input', 'save-fuel-limit-button']) {
    $(id).disabled = busy || !connected;
  }
  $('car-content').classList.toggle('is-loading', busy);
}

function requireConfig() {
  return Boolean(config.googleClientId && !config.googleClientId.startsWith('YOUR_') && config.spreadsheetId);
}

async function loadVehicle() {
  setBusy(true);
  setSyncState('loading', 'Loading vehicle data…');
  try {
    const token = getAccessToken();
    const result = await syncCar(token, config);
    state.record = result.record;
    renderCar(state.record);
    setPhotoPreview('car-img-preview', 'car-img-placeholder', result.carImageUrl);
    setPhotoPreview('car-license-img', 'license-img-placeholder', result.licenseImageUrl);
    setCarFormEnabled(true);
    setSyncState('connected', 'Connected');
    if (result.imageErrors) toast('Vehicle data loaded, but some photos could not be loaded.');
  } catch (error) {
    setSyncState('error', 'Connection failed');
    $('connection-message').textContent = `${error.message} Check your Sheets access and try again.`;
    toast(error.message);
    setCarFormEnabled(false);
  } finally {
    setBusy(false);
  }
}

async function connectGoogle() {
  if (!requireConfig()) {
    toast('Set the Google OAuth Client ID in config.js first.');
    return;
  }
  const retainedForm = state.record ? readCarForm() : null;
  const retainedMemo = state.record ? $('car-memo').value : '';
  setBusy(true);
  try {
    await requestAccessToken();
    await loadVehicle();
    if (retainedForm && state.record) {
      for (const [field, value] of Object.entries(retainedForm)) {
        const input = document.querySelector(`[name="${field}"]`);
        if (input) input.value = value;
      }
      $('car-memo').value = retainedMemo;
    }
  } catch (error) {
    setSyncState('error', 'Not connected');
    $('connection-message').textContent = error.message;
    toast(error.message);
  } finally {
    setBusy(false);
  }
}

async function saveRecord(record, successMessage = 'Saved.') {
  const token = getAccessToken();
  setBusy(true);
    setSyncState('saving', 'Saving…');
  try {
    await saveSyncedCar(token, config, record);
    state.record = { ...record };
    setSyncState('connected', 'Synced');
    toast(successMessage);
  } catch (error) {
    setSyncState('error', 'Save failed');
    $('connection-message').textContent = `${error.message} Your changes are still here. Please try again.`;
    toast(`Save failed: ${error.message}`);
    throw error;
  } finally {
    setBusy(false);
  }
}

async function saveCarDetails(event) {
  event.preventDefault();
  const next = { ...state.record, ...readCarForm() };
  try {
    await saveRecord(next, 'Vehicle details saved.');
    renderCar(next);
    $('car-modal').close();
  } catch {}
}

async function saveMemo() {
  const next = { ...state.record, memo: $('car-memo').value };
  try { await saveRecord(next, 'Saved.'); } catch {}
}

async function addFuelExpense(event) {
  event.preventDefault();
  const amount = Number($('fuel-amount-input').value);
  if (!Number.isFinite(amount) || amount <= 0) {
    toast('Enter a fuel amount greater than zero.');
    return;
  }
  const fuelLimit = Math.max(1, Number(state.record.fuelLimit) || 5000);
  const fuelSpent = Math.max(0, Number(state.record.fuelSpent) || 0) + amount;
  const next = { ...state.record, fuelLimit: String(fuelLimit), fuelSpent: String(fuelSpent) };
  try {
    await saveRecord(next, 'Fuel fill saved.');
    renderCar(next);
    $('fuel-amount-input').value = '';
    $('fuel-dialog').close();
  } catch {}
}

async function saveFuelLimit(event) {
  event.preventDefault();
  const fuelLimit = Number($('fuel-limit-input').value);
  if (!Number.isFinite(fuelLimit) || fuelLimit <= 0) {
    toast('Enter a fuel budget limit greater than zero.');
    return;
  }
  const next = { ...state.record, fuelLimit: String(fuelLimit) };
  try {
    await saveRecord(next, 'Fuel budget saved.');
    renderCar(next);
  } catch {}
}

async function replacePhoto(file, key, imageId, placeholderId) {
  if (!file) return;
  setBusy(true);
  setSyncState('saving', 'Uploading photo…');
  try {
    const token = getAccessToken();
    const { fileId } = await uploadCarImage(token, file);
    const next = { ...state.record, [key]: fileId };
    await saveSyncedCar(token, config, next);
    state.record = next;
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(imageId, placeholderId, objectUrl);
    setSyncState('connected', 'Synced');
    toast('Photo updated.');
  } catch (error) {
    setSyncState('error', 'Upload failed');
    $('connection-message').textContent = `${error.message} Your previous photo is still available. Please try again.`;
    toast(`Photo upload failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function importLegacyFile(file) {
  if (!file) return;
  try {
    const imported = parseLegacyCar(await file.text());
    const hasCarData = Object.values(imported.record).some(value => value.trim()) || imported.carImage || imported.licenseImage;
    if (!hasCarData) throw new Error('This file does not contain vehicle data.');
    if (!window.confirm('Import this vehicle data and replace the current record in Google Sheets?')) return;
    const next = { ...state.record, ...imported.record };
    const token = getAccessToken();
    if (imported.carImage) {
      const blob = await (await fetch(imported.carImage)).blob();
      next.carImageFileId = (await uploadCarImage(token, blob)).fileId;
    }
    if (imported.licenseImage) {
      const blob = await (await fetch(imported.licenseImage)).blob();
      next.licenseImageFileId = (await uploadCarImage(token, blob)).fileId;
    }
    await saveRecord(next, 'Vehicle data imported.');
    renderCar(next);
    const [carPhoto, licensePhoto] = await Promise.allSettled([
      next.carImageFileId ? import('./car-drive.js').then(({ loadCarImage }) => loadCarImage(token, next.carImageFileId)) : '',
      next.licenseImageFileId ? import('./car-drive.js').then(({ loadCarImage }) => loadCarImage(token, next.licenseImageFileId)) : ''
    ]);
    setPhotoPreview('car-img-preview', 'car-img-placeholder', carPhoto.status === 'fulfilled' ? carPhoto.value : '');
    setPhotoPreview('car-license-img', 'license-img-placeholder', licensePhoto.status === 'fulfilled' ? licensePhoto.value : '');
    if (carPhoto.status === 'rejected' || licensePhoto.status === 'rejected') toast('Data imported, but some photos could not be loaded.');
  } catch (error) {
    toast(`Import failed: ${error.message}`);
  } finally {
    $('legacy-file-input').value = '';
  }
}

function signOutGoogle() {
  signOut();
  state.record = null;
  setPhotoPreview('car-img-preview', 'car-img-placeholder', '');
  setPhotoPreview('car-license-img', 'license-img-placeholder', '');
  setCarFormEnabled(false);
  $('connection-message').textContent = 'Connect to view and save vehicle data in Google Sheets.';
  setSyncState('disconnected', 'Not connected');
}

function setToday() {
  const date = new Date();
  $('today-date').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(date);
}

function activateTab(activeTab, focusTab = false) {
  const tabs = [...document.querySelectorAll('[role="tab"][data-tab-target]')];
  const panels = [...document.querySelectorAll('[data-tab-panel]')];
  const selectedId = activeTab.dataset.tabTarget;

  tabs.forEach(tab => {
    const selected = tab === activeTab;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  panels.forEach(panel => {
    panel.hidden = panel.dataset.tabPanel !== selectedId;
  });
  if (focusTab) activeTab.focus();
  window.scrollTo(0, 0);
}

function setupInstallApp() {
  const installButton = $('install-app-button');
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (isInstalled) installButton.hidden = true;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    state.installPrompt = event;
    installButton.hidden = isInstalled;
  });
  installButton.addEventListener('click', async () => {
    if (!state.installPrompt) return;
    const promptEvent = state.installPrompt;
    state.installPrompt = null;
    installButton.hidden = true;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') toast('Xswift was installed.');
  });
  window.addEventListener('appinstalled', () => {
    installButton.hidden = true;
    state.installPrompt = null;
    toast('Xswift was installed.');
  });

  if ('serviceWorker' in navigator) {
    const workerUrl = new URL('../service-worker.js', import.meta.url);
    const appScope = new URL('../', import.meta.url).pathname;
    navigator.serviceWorker.register(workerUrl, { scope: appScope }).catch(error => {
      console.warn('Xswift could not register its offline app shell.', error);
    });
  }
}

function bindEvents() {
  const tabs = [...document.querySelectorAll('[role="tab"][data-tab-target]')];
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', event => {
      let nextIndex;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      activateTab(tabs[nextIndex], true);
    });
  });
  $('sign-in-button').addEventListener('click', connectGoogle);
  $('connect-button').addEventListener('click', connectGoogle);
  $('settings-connect-button').addEventListener('click', connectGoogle);
  $('sign-out-button').addEventListener('click', signOutGoogle);
  $('edit-car-button').addEventListener('click', () => {
    renderCar(state.record);
    $('car-modal').showModal();
  });
  $('car-form').addEventListener('submit', saveCarDetails);
  $('save-memo-button').addEventListener('click', saveMemo);
  $('fuel-add-button').addEventListener('click', () => $('fuel-dialog').showModal());
  $('fuel-form').addEventListener('submit', addFuelExpense);
  $('fuel-settings-form').addEventListener('submit', saveFuelLimit);
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => $('car-modal').close()));
  document.querySelectorAll('[data-close-fuel-dialog]').forEach(button => button.addEventListener('click', () => $('fuel-dialog').close()));
  $('car-img-input').addEventListener('change', event => {
    replacePhoto(event.target.files[0], 'carImageFileId', 'car-img-preview', 'car-img-placeholder');
    event.target.value = '';
  });
  $('license-img-input').addEventListener('change', event => {
    replacePhoto(event.target.files[0], 'licenseImageFileId', 'car-license-img', 'license-img-placeholder');
    event.target.value = '';
  });
  $('settings-car-photo').addEventListener('click', () => $('car-img-input').click());
  $('settings-license-photo').addEventListener('click', () => $('license-img-input').click());
  $('import-legacy-button').addEventListener('click', () => $('legacy-file-input').click());
  $('legacy-file-input').addEventListener('change', event => importLegacyFile(event.target.files[0]));
}

async function initialize() {
  setToday();
  setupInstallApp();
  bindEvents();
  setCarFormEnabled(false);
  if (!requireConfig()) {
    $('connection-message').textContent = 'Set the Google OAuth Client ID in config.js before connecting.';
    $('sign-in-button').disabled = true;
    $('connect-button').disabled = true;
    setSyncState('error', 'Google setup required');
    return;
  }
  try {
    await initializeGoogleAuth(config.googleClientId);
    try {
      await refreshAccessTokenSilently();
      $('connection-panel').hidden = true;
      $('sign-in-button').hidden = true;
      $('sign-out-button').hidden = false;
      $('car-content').hidden = false;
      await loadVehicle();
    } catch {
      // Google may require an explicit user gesture after a long idle period.
      // Keep the connect action visible in that case.
    }
  } catch (error) {
    $('connection-message').textContent = error.message;
    $('sign-in-button').disabled = true;
    $('connect-button').disabled = true;
    setSyncState('error', 'Google unavailable');
  }
}

initialize();






