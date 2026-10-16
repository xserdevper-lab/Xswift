const feedUrl = 'https://www.eppo.go.th/wp-json/oil-api/v1/oil-prices';
const outputPath = new URL('../fuel-prices.json', import.meta.url);

const response = await fetch(feedUrl, {
  headers: { Accept: 'application/json' },
  signal: AbortSignal.timeout(20_000),
});
if (!response.ok) throw new Error(`EPPO returned HTTP ${response.status}`);

const payload = await response.json();
if (payload?.status !== 'success' || !payload?.data?.ptt || !payload?.data?.bcp) {
  throw new Error('EPPO response is missing PTT or Bangchak prices');
}

await import('node:fs/promises').then(({ writeFile }) =>
  writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'),
);
console.log(`Saved EPPO prices effective ${payload.last_updated ?? 'date unavailable'}`);
