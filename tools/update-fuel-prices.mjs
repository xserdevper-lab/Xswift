const feedUrl = 'https://www.eppo.go.th/wp-json/oil-api/v1/oil-prices';
const bangchakFeedUrl = 'https://oil-price.bangchak.co.th/ApiOilPrice2/th';
const outputPath = new URL('../fuel-prices.json', import.meta.url);

async function fetchJson(url, source) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${source} returned HTTP ${response.status}`);
  return response.json();
}

const [payload, bangchakResponse] = await Promise.all([
  fetchJson(feedUrl, 'EPPO'),
  fetchJson(bangchakFeedUrl, 'Bangchak'),
]);
const bangchak = Array.isArray(bangchakResponse) ? bangchakResponse[0] : bangchakResponse;
if (payload?.status !== 'success' || !payload?.data?.ptt || !payload?.data?.bcp) {
  throw new Error('EPPO response is missing PTT or Bangchak prices');
}

const bangchakProducts = typeof bangchak?.OilList === 'string'
  ? JSON.parse(bangchak.OilList)
  : bangchak?.OilList;
if (!Array.isArray(bangchakProducts) || !bangchakProducts.length) {
  throw new Error('Bangchak response is missing tomorrow prices');
}

const bangchakProductByFuel = {
  gh95: /แก๊สโซฮอล์ 95/i,
  gh91: /แก๊สโซฮอล์ 91/i,
  e20: /แก๊สโซฮอล์ E20/i,
  e85: /แก๊สโซฮอล์ E85/i,
  ds: /^ไฮดีเซล S$/i,
  pds: /ไฮ พรีเมียม ดีเซล/i,
  dsb20: /ดีเซล B20/i,
};
const bangchakTomorrow = Object.fromEntries(Object.entries(bangchakProductByFuel).map(([fuel, pattern]) => {
  const product = bangchakProducts.find(item => pattern.test(String(item.OilName || '')));
  const price = Number(product?.PriceTomorrow);
  return [fuel, Number.isFinite(price) && price >= 0 ? price.toFixed(2) : ''];
}));

const [day, month, buddhistYear] = String(bangchak.OilDateNow || '').split('/').map(Number);
const tomorrowDate = day && month && buddhistYear
  ? new Date(Date.UTC(buddhistYear - 543, month - 1, day + 1)).toISOString().slice(0, 10)
  : '';
payload.tomorrow = {
  ptt: null,
  bcp: bangchakTomorrow,
  effectiveDate: tomorrowDate,
  bcpAnnouncementDate: bangchak.OilMessageDate || '',
  bcpAnnouncementTime: bangchak.OilMessageTime || '',
};

await import('node:fs/promises').then(({ writeFile }) =>
  writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'),
);
console.log(`Saved current prices from EPPO (${payload.last_updated ?? 'date unavailable'}) and tomorrow prices from Bangchak (${tomorrowDate || 'date unavailable'})`);
