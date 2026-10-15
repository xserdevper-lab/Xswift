import { getCar as loadVehicleRecord, saveCar as saveVehicleRecord } from './xswift-api.js?v=1';

export const CAR_FIELDS = [
  'model', 'plate', 'price', 'taxRenew', 'taxExpire', 'insType', 'insYear',
  'insExpire', 'licenseExpire', 'batteryDate', 'maintenanceDate', 'maintenanceIntervalMonths',
  'memo', 'carImageFileId', 'licenseImageFileId', 'fuelLimit', 'fuelSpent'
];

export function ensureCarSheet() {
  return loadVehicleRecord();
}

export function loadCar() {
  return loadVehicleRecord();
}

export function saveCar(record) {
  return saveVehicleRecord(record);
}

