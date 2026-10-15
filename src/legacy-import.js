const LEGACY_FIELDS = ['model', 'plate', 'price', 'taxRenew', 'taxExpire', 'insType', 'insYear', 'insExpire', 'licenseExpire', 'memo'];

export function parseLegacyCar(jsonText) {
  let source;
  try { source = JSON.parse(jsonText); } catch { throw new Error('The selected file is not valid JSON.'); }
  if (!source?.car || typeof source.car !== 'object' || Array.isArray(source.car)) {
    throw new Error('No vehicle data from the previous app was found in this file.');
  }
  const record = Object.fromEntries(LEGACY_FIELDS.map(key => [key, source.car[key] == null ? '' : String(source.car[key])]));
  record.carImageFileId = '';
  record.licenseImageFileId = '';
  return {
    record,
    carImage: typeof source.car.image === 'string' && source.car.image.startsWith('data:image/') ? source.car.image : '',
    licenseImage: typeof source.car.licenseImage === 'string' && source.car.licenseImage.startsWith('data:image/') ? source.car.licenseImage : ''
  };
}

