const STORAGE_KEY = 'xswift-weather-location-v1';
const API_URL = 'https://api.open-meteo.com/v1/forecast';

export function loadWeatherLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!Number.isFinite(saved?.latitude) || !Number.isFinite(saved?.longitude)) return null;
    return {
      latitude: Math.round(saved.latitude * 100) / 100,
      longitude: Math.round(saved.longitude * 100) / 100,
      weather: saved.weather || null,
      fetchedAt: Number(saved.fetchedAt) || 0
    };
  } catch (_) { return null; }
}

export function saveWeatherLocation(location) {
  const safe = {
    latitude: Math.round(location.latitude * 100) / 100,
    longitude: Math.round(location.longitude * 100) / 100,
    weather: location.weather || null,
    fetchedAt: Number(location.fetchedAt) || 0
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  return safe;
}

export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser does not support location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      error => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location permission is off. Allow location access in your browser settings and try again.'
          : error.code === error.TIMEOUT
            ? 'Could not get your location in time. Please try again.'
            : 'Could not get your location. Check your device settings and try again.';
        reject(new Error(message));
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
  });
}

export async function fetchCurrentWeather(location) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,wind_speed_10m,wind_gusts_10m',
    hourly: 'precipitation_probability,weather_code',
    forecast_hours: '6',
    timezone: 'auto'
  });
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${API_URL}?${params}`, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Weather service is temporarily unavailable.');
    const data = await response.json();
    if (!data.current || !Number.isFinite(data.current.temperature_2m) || !Number.isFinite(data.current.weather_code)) {
      throw new Error('Weather service returned incomplete data.');
    }
    const hourlyIndex = Array.isArray(data.hourly?.time)
      ? data.hourly.time.findIndex(time => time >= data.current.time)
      : -1;
    const chances = hourlyIndex >= 0 ? (data.hourly.precipitation_probability || []).slice(hourlyIndex, hourlyIndex + 3) : [];
    const rainCodes = hourlyIndex >= 0 ? (data.hourly.weather_code || []).slice(hourlyIndex, hourlyIndex + 3) : [];
    return {
      temperature: data.current.temperature_2m,
      apparentTemperature: data.current.apparent_temperature,
      weatherCode: data.current.weather_code,
      isDay: Boolean(data.current.is_day),
      precipitation: Number(data.current.precipitation) || 0,
      rain: Number(data.current.rain) || 0,
      showers: Number(data.current.showers) || 0,
      windSpeed: Number(data.current.wind_speed_10m) || 0,
      windGusts: Number(data.current.wind_gusts_10m) || 0,
      rainChanceNextHours: chances.length ? Math.max(...chances.map(value => Number(value) || 0)) : null,
      rainExpected: rainCodes.some(isRainCode),
      timezone: String(data.timezone || ''),
      modelTime: String(data.current.time || '')
    };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Weather update timed out. Please try again.');
    throw error;
  } finally { window.clearTimeout(timeout); }
}

export function describeWeather(code, isDay = true) {
  const value = Number(code);
  if (value === 0) return { label: isDay ? 'Clear sky' : 'Clear night', icon: isDay ? 'sun' : 'moon' };
  if (value === 1) return { label: 'Mostly clear', icon: 'sun-cloud' };
  if (value === 2) return { label: 'Partly cloudy', icon: 'sun-cloud' };
  if (value === 3) return { label: 'Overcast', icon: 'cloud' };
  if (value === 45 || value === 48) return { label: 'Fog', icon: 'fog' };
  if (value >= 51 && value <= 57) return { label: 'Drizzle', icon: 'rain' };
  if (value >= 61 && value <= 67) return { label: 'Rain', icon: 'rain' };
  if (value >= 71 && value <= 77) return { label: 'Snow', icon: 'rain' };
  if (value >= 80 && value <= 82) return { label: 'Rain showers', icon: 'rain' };
  if (value === 85 || value === 86) return { label: 'Snow showers', icon: 'rain' };
  if (value >= 95 && value <= 99) return { label: 'Thunderstorm', icon: 'storm' };
  return { label: 'Weather unavailable', icon: 'cloud' };
}

export function isRainCode(code) {
  const value = Number(code);
  return (value >= 51 && value <= 67) || (value >= 80 && value <= 82) || (value >= 95 && value <= 99);
}

export function weatherIconSvg(type) {
  const paths = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    moon: '<path d="M20.8 15.2A8.5 8.5 0 0 1 8.8 3.2 8.5 8.5 0 1 0 20.8 15.2Z"/>',
    'sun-cloud': '<circle cx="8" cy="8" r="3.5"/><path d="M8 2v1.5m-4.2.3 1 1M2 8h1.5m8.7-4.2-1 1"/><path d="M7 19h10a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.7 1A3 3 0 0 0 7 19Z"/>',
    cloud: '<path d="M6.5 19h10a4.5 4.5 0 0 0 .3-9 6.5 6.5 0 0 0-12.6 1.2A3.5 3.5 0 0 0 6.5 19Z"/>',
    fog: '<path d="M6.5 15h10a4 4 0 0 0 .3-8 6 6 0 0 0-11.5 1.2A3.3 3.3 0 0 0 6.5 15Zm-2 3h15m-13 3h11"/>',
    rain: '<path d="M6.5 14h10a4 4 0 0 0 .3-8 6 6 0 0 0-11.5 1.2A3.3 3.3 0 0 0 6.5 14Zm1 3-1 2m6-2-1 2m6-2-1 2"/>',
    storm: '<path d="M6.5 14h10a4 4 0 0 0 .3-8 6 6 0 0 0-11.5 1.2A3.3 3.3 0 0 0 6.5 14Z"/><path d="m13 14-4 5h3l-1 4 5-6h-3l1-3"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[type] || paths.cloud}</svg>`;
}
