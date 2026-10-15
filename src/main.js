import { initializeGoogleAuth, requestAccessToken, refreshAccessTokenSilently, getAccessToken, signOut } from './google-auth.js';
import { uploadCarImage } from './car-drive.js';
import { syncCar, saveSyncedCar } from './car-sync.js';
import { renderCar, readCarForm, setCarFormEnabled, setPhotoPreview, setSyncState } from './car-app.js';
import { parseLegacyCar } from './legacy-import.js';

const config = window.XSWIFT_CONFIG || {};
const state = { record: null, toastTimer: 0 };
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
  for (const id of ['edit-car-button', 'save-memo-button', 'car-photo-button', 'license-photo-button', 'save-car-button']) {
    $(id).disabled = busy || !connected;
  }
  $('car-content').classList.toggle('is-loading', busy);
}

function requireConfig() {
  return Boolean(config.googleClientId && !config.googleClientId.startsWith('YOUR_') && config.spreadsheetId);
}

async function loadVehicle() {
  setBusy(true);
  setSyncState('loading', 'กำลังโหลดข้อมูล');
  try {
    const token = getAccessToken();
    const result = await syncCar(token, config);
    state.record = result.record;
    renderCar(state.record);
    setPhotoPreview('car-img-preview', 'car-img-placeholder', result.carImageUrl);
    setPhotoPreview('car-license-img', 'license-img-placeholder', result.licenseImageUrl);
    setCarFormEnabled(true);
    setSyncState('connected', 'เชื่อมต่อแล้ว');
    if (result.imageErrors) toast('โหลดข้อมูลรถแล้ว แต่โหลดรูปบางรายการไม่สำเร็จ');
  } catch (error) {
    setSyncState('error', 'เชื่อมต่อไม่สำเร็จ');
    $('connection-message').textContent = `${error.message} ตรวจสิทธิ์ชีตและลองเชื่อมต่ออีกครั้ง`;
    toast(error.message);
    setCarFormEnabled(false);
  } finally {
    setBusy(false);
  }
}

async function connectGoogle() {
  if (!requireConfig()) {
    toast('กรุณาตั้งค่า Google OAuth Client ID ใน config.js');
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
    setSyncState('error', 'ยังไม่ได้เชื่อมต่อ');
    $('connection-message').textContent = error.message;
    toast(error.message);
  } finally {
    setBusy(false);
  }
}

async function saveRecord(record, successMessage = 'บันทึกแล้ว') {
  const token = getAccessToken();
  setBusy(true);
  setSyncState('saving', 'กำลังบันทึก');
  try {
    await saveSyncedCar(token, config, record);
    state.record = { ...record };
    setSyncState('connected', 'ซิงก์แล้ว');
    toast(successMessage);
  } catch (error) {
    setSyncState('error', 'บันทึกไม่สำเร็จ');
    $('connection-message').textContent = `${error.message} ข้อมูลที่แก้ไว้ยังอยู่ ลองบันทึกอีกครั้ง`;
    toast(`บันทึกไม่สำเร็จ: ${error.message}`);
    throw error;
  } finally {
    setBusy(false);
  }
}

async function saveCarDetails(event) {
  event.preventDefault();
  const next = { ...state.record, ...readCarForm() };
  try {
    await saveRecord(next, 'บันทึกข้อมูลรถแล้ว');
    renderCar(next);
    $('car-modal').close();
  } catch {}
}

async function saveMemo() {
  const next = { ...state.record, memo: $('car-memo').value };
  try { await saveRecord(next, 'บันทึกแล้ว'); } catch {}
}

async function replacePhoto(file, key, imageId, placeholderId) {
  if (!file) return;
  setBusy(true);
  setSyncState('saving', 'กำลังอัปโหลดรูป');
  try {
    const token = getAccessToken();
    const { fileId } = await uploadCarImage(token, file);
    const next = { ...state.record, [key]: fileId };
    await saveSyncedCar(token, config, next);
    state.record = next;
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(imageId, placeholderId, objectUrl);
    setSyncState('connected', 'ซิงก์แล้ว');
    toast('อัปโหลดรูปแล้ว');
  } catch (error) {
    setSyncState('error', 'อัปโหลดไม่สำเร็จ');
    $('connection-message').textContent = `${error.message} รูปเดิมยังใช้งานได้ ลองใหม่อีกครั้ง`;
    toast(`อัปโหลดรูปไม่สำเร็จ: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function importLegacyFile(file) {
  if (!file) return;
  try {
    const imported = parseLegacyCar(await file.text());
    const hasCarData = Object.values(imported.record).some(value => value.trim()) || imported.carImage || imported.licenseImage;
    if (!hasCarData) throw new Error('ไฟล์นี้ยังไม่มีข้อมูลรถให้นำเข้า');
    if (!window.confirm('นำเข้าข้อมูลรถจากไฟล์นี้และบันทึกทับข้อมูลรถใน Google Sheets หรือไม่?')) return;
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
    await saveRecord(next, 'นำเข้าข้อมูลรถแล้ว');
    renderCar(next);
    const [carPhoto, licensePhoto] = await Promise.allSettled([
      next.carImageFileId ? import('./car-drive.js').then(({ loadCarImage }) => loadCarImage(token, next.carImageFileId)) : '',
      next.licenseImageFileId ? import('./car-drive.js').then(({ loadCarImage }) => loadCarImage(token, next.licenseImageFileId)) : ''
    ]);
    setPhotoPreview('car-img-preview', 'car-img-placeholder', carPhoto.status === 'fulfilled' ? carPhoto.value : '');
    setPhotoPreview('car-license-img', 'license-img-placeholder', licensePhoto.status === 'fulfilled' ? licensePhoto.value : '');
    if (carPhoto.status === 'rejected' || licensePhoto.status === 'rejected') toast('นำเข้าข้อมูลแล้ว แต่โหลดรูปบางรายการไม่สำเร็จ');
  } catch (error) {
    toast(`นำเข้าไม่สำเร็จ: ${error.message}`);
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
  $('connection-message').textContent = 'ลงชื่อเข้าใช้เพื่อดูและบันทึกข้อมูลรถจาก Google Sheets';
  setSyncState('disconnected', 'ยังไม่ได้เชื่อมต่อ');
}

function setToday() {
  const date = new Date();
  const day = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][date.getDay()];
  const month = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][date.getMonth()];
  $('today-date').textContent = `วัน${day} ${date.getDate()} ${month}`;
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
  $('sign-out-button').addEventListener('click', signOutGoogle);
  $('edit-car-button').addEventListener('click', () => {
    renderCar(state.record);
    $('car-modal').showModal();
  });
  $('car-form').addEventListener('submit', saveCarDetails);
  $('save-memo-button').addEventListener('click', saveMemo);
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => $('car-modal').close()));
  $('car-photo-button').addEventListener('click', () => $('car-img-input').click());
  $('license-photo-button').addEventListener('click', () => $('license-img-input').click());
  $('car-img-input').addEventListener('change', event => replacePhoto(event.target.files[0], 'carImageFileId', 'car-img-preview', 'car-img-placeholder'));
  $('license-img-input').addEventListener('change', event => replacePhoto(event.target.files[0], 'licenseImageFileId', 'car-license-img', 'license-img-placeholder'));
  $('import-legacy-button').addEventListener('click', () => $('legacy-file-input').click());
  $('legacy-file-input').addEventListener('change', event => importLegacyFile(event.target.files[0]));
}

async function initialize() {
  setToday();
  bindEvents();
  setCarFormEnabled(false);
  if (!requireConfig()) {
    $('connection-message').textContent = 'ตั้งค่า Google OAuth Client ID ใน config.js ก่อนเชื่อมต่อ';
    $('sign-in-button').disabled = true;
    $('connect-button').disabled = true;
    setSyncState('error', 'รอตั้งค่า Google');
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
    setSyncState('error', 'Google ไม่พร้อมใช้งาน');
  }
}

initialize();



