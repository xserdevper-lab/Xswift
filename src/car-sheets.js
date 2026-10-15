export const CAR_FIELDS = ['model','plate','price','taxRenew','taxExpire','insType','insYear','insExpire','licenseExpire','batteryDate','maintenanceDate','maintenanceIntervalMonths','memo','carImageFileId','licenseImageFileId','fuelLimit','fuelSpent'];
const KEY='xswift-local-car-v1';
export function loadCar(){const saved=JSON.parse(localStorage.getItem(KEY)||'{}');return Object.fromEntries(CAR_FIELDS.map(k=>[k,String(saved[k]??'')]));}
export function ensureCarSheet(){return loadCar();}
export function saveCar(record){const saved=Object.fromEntries(CAR_FIELDS.map(k=>[k,String(record[k]??'')]));localStorage.setItem(KEY,JSON.stringify(saved));return saved;}
