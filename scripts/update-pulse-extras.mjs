import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REG_PATH = path.join(ROOT, 'public', 'official-registry.json');
const OUT_PATH = path.join(ROOT, 'public', 'data', 'pulse-extras.json');

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function pick(reg) {
  const contract = reg?.contract?.address || reg?.contractAddress || '';
  const pair = reg?.dex?.pair || reg?.pair?.address || '';
  const chain = (reg?.chain || reg?.dex?.chain || 'ethereum').toLowerCase();
  return { contract, pair, chain };
}

async function fetchText(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

function parseHoldersFromHtml(html) {
  // Try multiple patterns, Etherscan changes markup over time.
  // We only need the integer count.
  const patterns = [
    /Holders\s*:\s*<[^>]*>\s*([0-9,]+)/i,
    /Holders\s*<[^>]*>\s*([0-9,]+)/i,
    /"holders"\s*:\s*"?([0-9,]+)"?/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      const n = Number(String(m[1]).replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

async function getHoldersCount(contract) {
  if (!contract) return null;
  const url = `https://etherscan.io/token/${contract}`;
  const html = await fetchText(url, {
    headers: {
      // Avoid bot blocks / simplified markup differences
      'user-agent': 'Mozilla/5.0 (GitHub Actions) CapitokenPulse/1.0'
    }
  });
  return parseHoldersFromHtml(html);
}

async function getDexPrice(pair) {
  if (!pair) return null;
  const url = `https://api.dexscreener.com/latest/dex/pairs/ethereum/${pair}`;
  const j = await fetchJson(url, { headers: { 'user-agent': 'CapitokenPulse/1.0' } });
  const p = j?.pair || j?.pairs?.[0];
  const price = p?.priceUsd ? Number(p.priceUsd) : null;
  return Number.isFinite(price) ? price : null;
}

async function main() {
  const reg = readJson(REG_PATH);
  if (!reg) throw new Error('public/official-registry.json not found or invalid JSON');

  const { contract, pair, chain } = pick(reg);
  if (!contract) throw new Error('Contract address not found in official-registry.json');

  const prev = readJson(OUT_PATH) || {};

  // Holders (scraped, free)
  let holders = null;
  try {
    holders = await getHoldersCount(contract);
  } catch (e) {
    holders = null;
  }

  // Baseline launch price (sticky): set once, then keep.
  let launchPriceUsd = Number.isFinite(prev?.launchPriceUsd) ? prev.launchPriceUsd : null;
  let launchCapturedAt = prev?.launchCapturedAt || null;

  if (!launchPriceUsd) {
    try {
      const current = await getDexPrice(pair);
      if (Number.isFinite(current) && current > 0) {
        launchPriceUsd = current;
        launchCapturedAt = new Date().toISOString();
      }
    } catch {
      // ignore
    }
  }

  const out = {
    schema: 'capitoken-pulse-extras@1',
    updatedAt: new Date().toISOString(),
    chain,
    contract,
    pair,
    holders: Number.isFinite(holders) ? holders : (prev?.holders ?? null),
    launchPriceUsd: Number.isFinite(launchPriceUsd) ? launchPriceUsd : (prev?.launchPriceUsd ?? null),
    launchCapturedAt,
    sources: {
      holders: 'https://etherscan.io',
      baseline: 'https://api.dexscreener.com'
    }
  };

  writeJson(OUT_PATH, out);
  console.log('Wrote', OUT_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
