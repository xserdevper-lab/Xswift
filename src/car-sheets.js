const TAB_NAME = 'รถยนต์';
export const CAR_FIELDS = [
  'model', 'plate', 'price', 'taxRenew', 'taxExpire', 'insType', 'insYear',
  'insExpire', 'licenseExpire', 'memo', 'carImageFileId', 'licenseImageFileId'
];

function apiUrl(spreadsheetId, path = '') {
  return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}${path}`;
}

async function googleFetch(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    let message = `Google Sheets returned an error (${response.status})`;
    try { message = JSON.parse(detail).error?.message || message; } catch {}
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

function tabRange(range) {
  return `'${TAB_NAME}'!${range}`;
}

async function readRows(accessToken, spreadsheetId) {
  const range = encodeURIComponent(tabRange('A:B'));
  const result = await googleFetch(`${apiUrl(spreadsheetId, `/values/${range}`)}?majorDimension=ROWS`, accessToken);
  return result.values || [];
}

export async function ensureCarSheet(accessToken, spreadsheetId) {
  if (!spreadsheetId) throw new Error('Spreadsheet ID is not configured.');
  let metadata = await googleFetch(`${apiUrl(spreadsheetId)}?fields=sheets.properties(sheetId,title)`, accessToken);
  let sheet = metadata.sheets?.find(item => item.properties?.title === TAB_NAME);
  if (!sheet) {
    await googleFetch(apiUrl(spreadsheetId, ':batchUpdate'), accessToken, {
      method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB_NAME } } }] })
    });
    metadata = await googleFetch(`${apiUrl(spreadsheetId)}?fields=sheets.properties(sheetId,title)`, accessToken);
    sheet = metadata.sheets?.find(item => item.properties?.title === TAB_NAME);
    if (!sheet) throw new Error('Could not create the vehicle sheet tab.');
  }

  const rows = await readRows(accessToken, spreadsheetId);
  if (!rows.length) {
    const initialRows = [['key', 'value'], ...CAR_FIELDS.map(key => [key, ''])];
    const range = encodeURIComponent(tabRange(`A1:B${initialRows.length}`));
    await googleFetch(`${apiUrl(spreadsheetId, `/values/${range}`)}?valueInputOption=RAW`, accessToken, {
      method: 'PUT', body: JSON.stringify({ range: tabRange(`A1:B${initialRows.length}`), majorDimension: 'ROWS', values: initialRows })
    });
  } else if (rows[0]?.[0] !== 'key' || rows[0]?.[1] !== 'value') {
    throw new Error(`The “${TAB_NAME}” sheet tab has an unexpected format. It was not changed.`);
  }
  return sheet.properties.sheetId;
}

export async function loadCar(accessToken, spreadsheetId) {
  await ensureCarSheet(accessToken, spreadsheetId);
  const rows = await readRows(accessToken, spreadsheetId);
  const record = Object.fromEntries(CAR_FIELDS.map(field => [field, '']));
  for (const [key, value] of rows.slice(1)) {
    if (CAR_FIELDS.includes(key)) record[key] = value ?? '';
  }
  return record;
}

export async function saveCar(accessToken, spreadsheetId, carRecord) {
  await ensureCarSheet(accessToken, spreadsheetId);
  const rows = await readRows(accessToken, spreadsheetId);
  const rowByKey = new Map();
  rows.slice(1).forEach((row, index) => {
    const key = row?.[0];
    if (CAR_FIELDS.includes(key) && !rowByKey.has(key)) rowByKey.set(key, index + 2);
  });

  const updates = [];
  const missing = [];
  for (const field of CAR_FIELDS) {
    const value = carRecord[field] == null ? '' : String(carRecord[field]);
    const row = rowByKey.get(field);
    if (row) updates.push({ range: tabRange(`B${row}`), values: [[value]] });
    else missing.push([field, value]);
  }
  if (missing.length) {
    const startRow = Math.max(rows.length + 1, 2);
    updates.push({ range: tabRange(`A${startRow}:B${startRow + missing.length - 1}`), values: missing });
  }
  await googleFetch(`${apiUrl(spreadsheetId, `/values:batchUpdate`)}?valueInputOption=RAW`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data: updates })
  });
}

