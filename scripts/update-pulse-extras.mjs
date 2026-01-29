import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const REG_PATH = path.join(ROOT, 'public', 'official-registry.json');
const OUT_PATH = path.join(ROOT, 'public', 'data', 'pulse-extras.json');

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';

function nowIso() {
  return new Date().toISOString();
}

async function readJson(p) {
  const txt = await fs.readFile(p, 'utf8');
  return JSON.parse(txt);
}

async function writeJson(p, obj) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

async function fetchDexPair(chain, pair) {
  const url = `https://api.dexscreener.com/latest/dex/pairs/${encodeURIComponent(chain)}/${encodeURIComponent(pair)}`;
  const data = await fetchJson(url);
  return data.pair || (Array.isArray(data.pairs) ? data.pairs[0] : null);
}

async function fetchHoldersEtherscan(contract) {
  if (!ETHERSCAN_API_KEY) return { holders: null, error: 'missing ETHERSCAN_API_KEY' };
  if (!contract) return { holders: null, error: 'missing contract' };

  const url = `https://api.etherscan.io/api?module=token&action=tokenholdercount&contractaddress=${encodeURIComponent(contract)}&apikey=${encodeURIComponent(ETHERSCAN_API_KEY)}`;
  const data = await fetchJson(url);

  if ((data?.status === '1' || data?.message === 'OK') && data?.result) {
    const n = Number(data.result);
    if (Number.isFinite(n)) return { holders: n, error: '' };
    return { holders: null, error: 'invalid result' };
  }

  const msg = typeof data?.result === 'string' ? data.result : (data?.message ? String(data.message) : 'not ok');
  return { holders: null, error: msg.slice(0, 120) };
}

async function main() {
  const reg = await readJson(REG_PATH);

  const chain = String(reg?.pair?.chain || reg?.dex?.dexscreener?.chain || 'ethereum').toLowerCase();
  const pair = reg?.pair?.address || reg?.dex?.pair || '';
  const contract = reg?.contract?.address || '';

  if (!pair) throw new Error('Pair address missing in official-registry.json');
  if (!contract) throw new Error('Contract address missing in official-registry.json');

  // Read previous output if it exists (to preserve launch baseline).
  let prev = null;
  try {
    prev = await readJson(OUT_PATH);
  } catch {}

  const dexPair = await fetchDexPair(chain, pair);

  const priceUsd = dexPair?.priceUsd ? Number(dexPair.priceUsd) : null;
  const pairCreatedAt = dexPair?.pairCreatedAt ? Number(dexPair.pairCreatedAt) : null;

  const { holders, error: holdersError } = await fetchHoldersEtherscan(contract);

  const prevLaunchPrice = prev?.launch?.priceUsd ?? null;
  const prevLaunchAt = prev?.launch?.at ?? null;

  // If baseline not set yet, set it to the first valid observed price (server-side).
  const launchPriceUsd =
    (Number.isFinite(prevLaunchPrice) && prevLaunchPrice > 0) ? prevLaunchPrice :
    (Number.isFinite(priceUsd) && priceUsd > 0) ? priceUsd :
    null;

  const launchAt =
    prevLaunchAt ? prevLaunchAt :
    (launchPriceUsd !== null ? nowIso() : null);

  const out = {
    version: 'pulse-extras-v1',
    updatedAt: nowIso(),
    chain,
    pair,
    contract,
    dex: {
      priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
      pairCreatedAt: Number.isFinite(pairCreatedAt) ? pairCreatedAt : null
    },
    etherscan: {
      holders: Number.isFinite(holders) ? holders : null,
      error: holdersError || ''
    },
    launch: {
      priceUsd: launchPriceUsd,
      at: launchAt
    }
  };

  await writeJson(OUT_PATH, out);
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
