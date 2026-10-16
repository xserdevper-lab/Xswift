
import { loginWithPin, getCar as getRemoteCar, saveCar as saveRemoteCar, getServiceHistory as getRemoteServiceHistory, saveServiceHistory as saveRemoteServiceHistory, clearSession } from './xswift-api.js?v=3';
import { uploadCarImage } from './car-drive.js?v=2';
import { syncCar, saveSyncedCar } from './car-sync.js?v=2';
import { renderCar, readCarForm, setCarFormEnabled, setPhotoPreview, setSyncState } from './car-app.js?v=5';
import { parseLegacyCar } from './legacy-import.js';
import { loadServiceHistory as loadLocalServiceHistory, saveServiceHistory as saveLocalServiceHistory, createServiceRecord } from './service-history.js';

const config = window.XSWIFT_CONFIG || {};
const state = { record: null, toastTimer: 0, installPrompt: null };
let serviceHistory = loadLocalServiceHistory();
const $ = id => document.getElementById(id);
const fuelPriceFeed = './fuel-prices.json';
const fuelTypes = [
  ['Gasohol 95', 'gh95'],
  ['Gasohol 91', 'gh91'],
  ['Gasohol E20', 'e20'],
  ['Gasohol E85', 'e85'],
  ['Gasoline 95', 'gl95'],
  ['Premium Gasohol 95', 'gs95p'],
  ['Premium Gasohol 99', 'gs99p'],
  ['Diesel B7', 'ds'],
  ['Premium Diesel', 'pds'],
  ['Diesel B20', 'dsb20']
];

function toast(message) {
  const element = $('toast');
  element.textContent = message;
  element.classList.add('show');
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => element.classList.remove('show'), 2800);
}

function setBusy(busy) {
  const connected = Boolean(state.record);
  const pinInput = $('pin-input');
  const pinButton = $('pin-submit-button');
  const signOutButton = $('sign-out-button');
  if (pinInput) pinInput.disabled = busy;
  if (pinButton) pinButton.disabled = busy || !requireConfig();
  if (signOutButton) signOutButton.disabled = busy || !connected;
  for (const id of ['edit-car-button', 'save-memo-button', 'save-car-button', 'fuel-amount-input', 'fuel-add-button', 'fuel-limit-input', 'save-fuel-limit-button', 'reset-fuel-usage-button', 'add-service-record-button']) {
    const control = $(id);
    if (control) control.disabled = busy || !connected;
  }
  $('car-content').classList.toggle('is-loading', busy);
}
function requireConfig() { return true; }

const serviceCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 });
function renderServiceHistory() {
  const list = $('service-history-list');
  if (!list) return;
  list.replaceChildren();
  const total = serviceHistory.reduce((sum, record) => sum + record.amount, 0);
  $('service-history-count').textContent = `${serviceHistory.length} ${serviceHistory.length === 1 ? 'record' : 'records'}`;
  $('service-history-total').textContent = serviceCurrency.format(total);
  $('service-history-empty').hidden = serviceHistory.length > 0;
  list.hidden = serviceHistory.length === 0;
  for (const record of serviceHistory) {
    const item = document.createElement('li'); item.className = 'service-history-item';
    const details = document.createElement('div'); details.className = 'service-history-item-details';
    const title = document.createElement('strong'); title.textContent = record.description;
    const date = document.createElement('time'); date.dateTime = record.date;
    date.textContent = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${record.date}T00:00:00Z`));
    const amount = document.createElement('strong'); amount.className = 'service-history-amount'; amount.textContent = serviceCurrency.format(record.amount);
    const remove = document.createElement('button'); remove.className = 'service-history-delete'; remove.type = 'button'; remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete ${record.description} service record`); remove.addEventListener('click', () => deleteServiceRecord(record.id));
    details.append(title, date); item.append(details, amount, remove); list.append(item);
  }
}

function localTodayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function saveServiceRecord(event) {
  event.preventDefault();
  const form = $('service-form'); if (!form.reportValidity()) return;
  try {
    const record = createServiceRecord({ date: $('service-date-input').value, description: $('service-description-input').value, amount: Number($('service-cost-input').value) });
    serviceHistory = saveLocalServiceHistory([record, ...serviceHistory]); renderServiceHistory(); form.reset(); $('service-dialog').close(); toast('Service record saved on this device.');
  } catch (error) { toast(error.message); }
}

function deleteServiceRecord(id) {
  const record = serviceHistory.find(item => item.id === id);
  if (!record || !window.confirm(`Delete the service record “${record.description}”?`)) return;
  try { serviceHistory = saveLocalServiceHistory(serviceHistory.filter(item => item.id !== id)); renderServiceHistory(); toast('Service record deleted from this device.'); }
  catch (error) { toast(error.message); }
}

async function loadVehicle() {
  setBusy(true);
  setSyncState('loading', 'Loading vehicle data…');
  try {
    const result = await syncCar(config);
    state.record = result.record;
    renderCar(state.record);
    setPhotoPreview('car-img-preview', 'car-img-placeholder', result.carImageUrl);
    setPhotoPreview('car-license-img', 'license-img-placeholder', result.licenseImageUrl);
    setCarFormEnabled(true);
    setSyncState('connected', 'Connected');
    if (result.imageErrors) toast('Vehicle data loaded, but some photos could not be loaded.');
  } catch (error) {
    setSyncState('error', 'Local storage error');
    $('connection-message').textContent = error.message;
    toast(error.message);
    throw error;
  } finally {
    setBusy(false);
  }
}

async function saveRecord(record, successMessage = 'Saved.') {
  setBusy(true);
  setSyncState('saving', 'Saving…');
  try {
    await saveSyncedCar(config, record);
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

async function resetFuelUsage() {
  if (!state.record) return;
  if (!(Number(state.record.fuelSpent) > 0)) {
    toast('Fuel usage is already zero.');
    return;
  }
  if (!window.confirm('Reset fuel usage to ฿0? Your fuel budget limit and other vehicle data will stay unchanged.')) return;
  const next = { ...state.record, fuelSpent: '0' };
  try {
    await saveRecord(next, 'Fuel usage reset.');
    renderCar(next);
  } catch {}
}

async function replacePhoto(file, key, imageId, placeholderId) {
  if (!file) return;
  setBusy(true);
  setSyncState('saving', 'Uploading photo…');
  try {
    const { fileId } = await uploadCarImage(file);
    const next = { ...state.record, [key]: fileId };
    await saveSyncedCar(config, next);
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
    if (!window.confirm('Import this vehicle data and replace the current Xswift vehicle record?')) return;
    const next = { ...state.record, ...imported.record };
    if (imported.carImage) {
      const blob = await (await fetch(imported.carImage)).blob();
      next.carImageFileId = (await uploadCarImage(blob)).fileId;
    }
    if (imported.licenseImage) {
      const blob = await (await fetch(imported.licenseImage)).blob();
      next.licenseImageFileId = (await uploadCarImage(blob)).fileId;
    }
    await saveRecord(next, 'Vehicle data imported.');
    renderCar(next);
    const [carPhoto, licensePhoto] = await Promise.allSettled([
      next.carImageFileId ? import('./car-drive.js?v=2').then(({ loadCarImage }) => loadCarImage(next.carImageFileId)) : '',
      next.licenseImageFileId ? import('./car-drive.js?v=2').then(({ loadCarImage }) => loadCarImage(next.licenseImageFileId)) : ''
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
  if (selectedId === 'fuel-prices') loadFuelPrices();
}

function formatEffectiveTime(date, time) {
  if (!date) return '—';
  const parsed = new Date(`${date}T${time || '00:00'}:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok'
  }).format(parsed);
}

function renderFuelPrices(payload) {
  const { ptt, bcp } = payload.data || {};
  const caltex = payload.data?.caltex;
  if (!ptt || !bcp || !caltex) throw new Error('The price feed is missing PTT, Bangchak, or Caltex data.');
  const tableRows = fuelTypes.map(([label, key]) => {
    const row = document.createElement('tr');
    const type = document.createElement('th');
    type.scope = 'row';
    type.textContent = label;
    row.append(type);
    for (const [brand, record] of [['ptt', ptt], ['bcp', bcp], ['caltex', caltex]]) {
      const cell = document.createElement('td');
      const rawPrice = record[`oil_${brand}_${key}`];
      const number = rawPrice === null || rawPrice === undefined || rawPrice === '-' ? NaN : Number(rawPrice);
      cell.textContent = Number.isFinite(number) && number >= 0 ? number.toFixed(2) : '—';
      row.append(cell);
    }
    return row;
  });
  $('fuel-price-rows').replaceChildren(...tableRows);
  $('fuel-prices-updated').textContent = `PTT effective ${formatEffectiveTime(ptt.oil_ptt_date, ptt.oil_ptt_time)} · Bangchak effective ${formatEffectiveTime(bcp.oil_bcp_date, bcp.oil_bcp_time)} · Caltex effective ${formatEffectiveTime(caltex.oil_caltex_date, caltex.oil_caltex_time)}`;

  const tomorrow = payload.tomorrow;
  const tomorrowRows = fuelTypes.map(([label, key]) => {
    const row = document.createElement('tr');
    const type = document.createElement('th');
    type.scope = 'row';
    type.textContent = label;
    row.append(type);
    for (const brand of ['ptt', 'bcp', 'caltex']) {
      const cell = document.createElement('td');
      const rawPrice = tomorrow?.[brand]?.[key];
      const number = rawPrice === null || rawPrice === undefined || rawPrice === '' || rawPrice === '-' ? NaN : Number(rawPrice);
      cell.textContent = Number.isFinite(number) && number >= 0 ? number.toFixed(2) : '—';
      row.append(cell);
    }
    return row;
  });
  $('fuel-price-tomorrow-rows').replaceChildren(...tomorrowRows);
  $('fuel-prices-tomorrow-date').textContent = tomorrow?.effectiveDate
    ? `Prices effective ${formatFuelPriceDate(tomorrow.effectiveDate)}`
    : 'Tomorrow’s price date unavailable';
  $('fuel-prices-tomorrow-state').textContent = tomorrow?.bcp ? 'Bangchak data available' : 'Bangchak data unavailable';
}

function formatFuelPriceDate(date) {
  const parsed = new Date(`${date}T05:00:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok'
  }).format(parsed);
}

async function loadFuelPrices() {
  const button = $('refresh-fuel-prices');
  const status = $('fuel-prices-state');
  button.disabled = true;
  status.textContent = 'Updating…';
  try {
    const response = await fetch(fuelPriceFeed, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.status !== 'success') throw new Error('The price feed is unavailable.');
    renderFuelPrices(payload);
    status.textContent = payload.last_updated ? `Feed updated ${payload.last_updated}` : 'Prices updated';
  } catch (error) {
    $('fuel-prices-updated').textContent = 'Current prices are unavailable.';
    const row = document.createElement('tr');
    const message = document.createElement('td');
    message.colSpan = 4;
    message.className = 'fuel-price-placeholder';
    message.textContent = 'Could not load current prices. Tap Refresh to try again.';
    row.append(message);
    $('fuel-price-rows').replaceChildren(row);
    $('fuel-prices-tomorrow-date').textContent = 'Tomorrow’s prices are unavailable.';
    $('fuel-prices-tomorrow-state').textContent = 'Unable to update';
    const tomorrowRow = row.cloneNode(true);
    tomorrowRow.firstElementChild.textContent = 'Could not load tomorrow’s prices. Tap Refresh to try again.';
    $('fuel-price-tomorrow-rows').replaceChildren(tomorrowRow);
    status.textContent = 'Unable to update';
  } finally {
    button.disabled = false;
  }
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


let sheetConnected = false;
function sheetStatus(message) { const node = $('sheet-sync-status'); if(node) node.textContent = message; }
function sheetControls(busy = false) {
  for (const id of ['sheet-connect','sheet-pull','sheet-push','sheet-disconnect','sheet-sync-button']) {
    const node = $(id); if(node) node.disabled = busy;
  }
  $('sheet-sync-actions').hidden = !sheetConnected;
  $('sheet-sync-button').disabled = busy || !sheetConnected;
}
async function connectSheet() {
  const pin = $('sheet-pin').value.trim();
  if (!/^\d{6}$/.test(pin)) { sheetStatus('Enter the private 6-digit PIN to connect.'); return; }
  sheetControls(true); sheetStatus('Connecting to Google Sheets…');
  try {
    await loginWithPin(pin);
    sheetConnected = true;
    $('sheet-pin').value = '';
    $('sheet-pin').hidden = true;
    sheetStatus('Connected. Data transfers only when you choose Download or Upload.');
  } catch(e) { sheetStatus('Connection failed: ' + e.message); }
  finally { sheetControls(false); }
}
async function pullSheet() {
  if (!sheetConnected || !window.confirm('Replace vehicle details and service history on this device with Google Sheets data? Local details and history will be overwritten. Photos are not included.')) return;
  sheetControls(true); sheetStatus('Downloading from Google Sheets…');
  try {
    const [remote, remoteHistory] = await Promise.all([getRemoteCar(), getRemoteServiceHistory()]);
    const next = { ...state.record, ...Object.fromEntries(Object.entries(remote).filter(([key]) => !['carImageFileId','licenseImageFileId'].includes(key))) };
    await saveSyncedCar(config,next);
    serviceHistory = saveLocalServiceHistory(remoteHistory);
    renderServiceHistory();
    await loadVehicle();
    sheetStatus('Vehicle details and service history downloaded to this device.');
  } catch(e) { sheetStatus('Download failed: ' + e.message); }
  finally { sheetControls(false); }
}
async function pushSheet() {
  if (!sheetConnected || !state.record || !window.confirm('Overwrite vehicle details and service history in Google Sheets with this device\'s data? Photos will not be uploaded.')) return;
  sheetControls(true); sheetStatus('Uploading to Google Sheets…');
  try {
    const remote = await getRemoteCar();
    const next = { ...remote, ...Object.fromEntries(Object.entries(state.record).filter(([key]) => !['carImageFileId','licenseImageFileId'].includes(key))) };
    const results = await Promise.allSettled([saveRemoteCar(next), saveRemoteServiceHistory(serviceHistory)]);
    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length) throw new Error(failed.map(result => result.reason?.message || 'One data section failed').join('; '));
    sheetStatus('Vehicle details and service history uploaded to Google Sheets.');
  } catch(e) { sheetStatus('Upload failed: ' + e.message); }
  finally { sheetControls(false); }
}
function disconnectSheet() {
  clearSession(); sheetConnected = false; $('sheet-pin').hidden = false;
  sheetControls(); sheetStatus('Disconnected. Local data is unchanged.');
}

function bindEvents() {
  $('refresh-fuel-prices').addEventListener('click', loadFuelPrices);
  $('sheet-connect').addEventListener('click',connectSheet);
  $('sheet-sync-button').addEventListener('click', () => { if (!sheetConnected) { sheetStatus('Connect Google Sheets first.'); return; } $('sheet-sync-actions').hidden = false; $('sheet-sync-actions').scrollIntoView({behavior:'smooth',block:'nearest'}); });
  $('sheet-pull').addEventListener('click',pullSheet);
  $('sheet-push').addEventListener('click',pushSheet);
  $('sheet-disconnect').addEventListener('click',disconnectSheet);
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


  $('edit-car-button').addEventListener('click', () => {
    renderCar(state.record);
    $('car-modal').showModal();
  });
  $('car-form').addEventListener('submit', saveCarDetails);
  $('save-memo-button').addEventListener('click', saveMemo);
  $('fuel-add-button').addEventListener('click', () => $('fuel-dialog').showModal());
  $('fuel-form').addEventListener('submit', addFuelExpense);
  $('fuel-settings-form').addEventListener('submit', saveFuelLimit);
  $('reset-fuel-usage-button').addEventListener('click', resetFuelUsage);
  $('add-service-record-button').addEventListener('click', () => { $('service-date-input').value = localTodayISO(); $('service-dialog').showModal(); });
  $('service-form').addEventListener('submit', saveServiceRecord);
  document.querySelectorAll('[data-close-service-dialog]').forEach(button => button.addEventListener('click', () => $('service-dialog').close()));
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
  renderServiceHistory();
  setCarFormEnabled(false);
  try {
    await loadVehicle();
  } catch (_) {
    // loadVehicle has already updated the visible state and kept retry data available.
  }
}

initialize();






