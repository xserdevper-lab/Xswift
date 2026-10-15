import { loadCarImage as getVehicleImage, uploadCarImage as saveVehicleImage } from './xswift-api.js?v=1';

export function uploadCarImage(file) {
  return saveVehicleImage(file);
}

export function loadCarImage(fileId) {
  return getVehicleImage(fileId);
}

