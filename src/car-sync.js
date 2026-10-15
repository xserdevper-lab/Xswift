import { loadCar, saveCar } from './car-sheets.js?v=1';
import { loadCarImage } from './car-drive.js?v=1';

export async function syncCar() {
  const record = await loadCar();
  const [carImageResult, licenseImageResult] = await Promise.allSettled([
    loadCarImage(record.carImageFileId),
    loadCarImage(record.licenseImageFileId)
  ]);
  return {
    record,
    carImageUrl: carImageResult.status === 'fulfilled' ? carImageResult.value : '',
    licenseImageUrl: licenseImageResult.status === 'fulfilled' ? licenseImageResult.value : '',
    imageErrors: [carImageResult, licenseImageResult].filter(result => result.status === 'rejected').length
  };
}

export function saveSyncedCar(_config, record) {
  return saveCar(record);
}

