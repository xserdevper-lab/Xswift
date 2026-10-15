import { loadCar, saveCar } from './car-sheets.js';
import { loadCarImage } from './car-drive.js';

export async function syncCar(accessToken, { spreadsheetId }) {
  const record = await loadCar(accessToken, spreadsheetId);
  const [carImageResult, licenseImageResult] = await Promise.allSettled([
    loadCarImage(accessToken, record.carImageFileId),
    loadCarImage(accessToken, record.licenseImageFileId)
  ]);
  return {
    record,
    carImageUrl: carImageResult.status === 'fulfilled' ? carImageResult.value : '',
    licenseImageUrl: licenseImageResult.status === 'fulfilled' ? licenseImageResult.value : '',
    imageErrors: [carImageResult, licenseImageResult].filter(result => result.status === 'rejected').length
  };
}

export function saveSyncedCar(accessToken, config, record) {
  return saveCar(accessToken, config.spreadsheetId, record);
}
