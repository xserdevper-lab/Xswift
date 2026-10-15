const LEGACY_FIELDS = ['model', 'plate', 'price', 'taxRenew', 'taxExpire', 'insType', 'insYear', 'insExpire', 'licenseExpire', 'memo'];

export function parseLegacyCar(jsonText) {
  let source;
  try { source = JSON.parse(jsonText); } catch { throw new Error('ไฟล์ข้อมูลเดิมไม่ใช่ JSON ที่อ่านได้'); }
  if (!source?.car || typeof source.car !== 'object' || Array.isArray(source.car)) {
    throw new Error('ในไฟล์ไม่พบข้อมูลรถจากแอปเดิม');
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
