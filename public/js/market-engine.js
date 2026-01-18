/* Capitoken – Phase 9.4: Market Engine
   - DexScreener swaps + market health snapshot
   - Safe for GitHub Pages (no absolute paths)
   - Cache TTL 60s
*/

const DEFAULT_TTL = 60_000;

let CFG = {
  baseUrl: null,
  pairAddress: null,
  tokenAddress: null,
  rpcUrl: 'https://cloudflare-eth.com',
  ttlMs: DEFAULT_TTL,
};

let mem = {
  snapshot: null,
  snapshotAt: 0,
  swaps: null,
  swapsAt: 0,
};

// block timestamp cache (per session)
const __blockTsCache = new Map();

function lsGet(key){
  try{ return JSON.parse(localStorage.getItem(key) || 'null'); }catch{ return null; }
}
function lsSet(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch{}
}

export function setMarketConfig(partial = {}){
  CFG = { ...CFG, ...partial };
}

function now(){ return Date.now(); }

function isFresh(ts, ttl){
  return (now() - (ts || 0)) < (ttl || DEFAULT_TTL);
}

async function fetchJson(url){
  const r = await fetch(url, { cache: 'no-store' });
  if(!r.ok) throw new Error('HTTP ' + r.status);
  return await r.json();
}

async function loadRegistry(){
  // Using window.location.href preserves /capitoken-site/ base path.
  const url = new URL('official-registry.json', window.location.href).toString();
  return await fetchJson(url);
}

async function resolveTokenAddress(){
  if (CFG.tokenAddress) return String(CFG.tokenAddress);
  try{
    const reg = await loadRegistry();
    const t = reg?.token?.address || reg?.contract?.address || reg?.tokenAddress || reg?.contractAddress || '';
    if (t) return String(t);
  }catch{}
  return '';
}

async function resolvePairAddress(){
  if (CFG.pairAddress) return String(CFG.pairAddress);
  try{
    const reg = await loadRegistry();
    const p = reg?.pair?.address || reg?.pairAddress || reg?.uniswapPair || reg?.dexPair || '';
    if (p) return String(p);
  }catch{}
  return '';
}

function normalizeTrade(t){
  // DexScreener trades shape varies; we map best-effort.
  const ts = t?.timestamp ? Number(t.timestamp) : (t?.time ? Number(t.time) : NaN);
  const side = String(t?.type || t?.side || '').toUpperCase();
  const amountUsd = Number(t?.usdAmount ?? t?.amountUsd ?? t?.amountUSD ?? t?.valueUsd ?? NaN);
  const priceUsd = Number(t?.priceUsd ?? t?.priceUSD ?? NaN);
  const maker = t?.maker || t?.tx?.from || t?.from || '';
  const txHash = t?.txHash || t?.transactionHash || t?.tx?.hash || '';

  return {
    ts: Number.isFinite(ts) ? ts : now(),
    side: (side === 'BUY' || side === 'SELL') ? side : (t?.isBuy ? 'BUY' : t?.isSell ? 'SELL' : ''),
    amountUsd: Number.isFinite(amountUsd) ? amountUsd : null,
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    maker: maker ? String(maker) : '',
    txHash: txHash ? String(txHash) : '',
  };
}

function estimateSlippagePct(tradeUsd, liquidityUsd){
  const t = Number(tradeUsd);
  const L = Number(liquidityUsd);
  if(!Number.isFinite(t) || !Number.isFinite(L) || L <= 0) return null;
  // Simple heuristic: slippage grows roughly with trade size / liquidity.
  const raw = (t / L) * 100;
  const pct = Math.min(25, raw * 1.5);
  return Math.max(0, pct);
}

// -----------------------------------------------------
// On-chain swaps (Uniswap V2 Pair Swap event)
// DexScreener public REST API does NOT expose a trades
// endpoint in the official docs; use on-chain logs.
// Ref: https://docs.dexscreener.com/api/reference
// -----------------------------------------------------

const UNISWAP_V2_SWAP_TOPIC0 = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
const SIG_TOKEN0 = '0x0dfe1681'; // token0()
const SIG_TOKEN1 = '0xd21220a7'; // token1()

function hexToBigInt(hex){
  try{ return BigInt(hex); }catch{ return 0n; }
}

function wordToBigInt(dataHex, wordIndex){
  const h = String(dataHex || '0x');
  const start = 2 + wordIndex * 64;
  const slice = '0x' + h.slice(start, start + 64);
  return hexToBigInt(slice);
}

function topicToAddress(topicHex){
  const t = (topicHex || '').toLowerCase();
  if (!t.startsWith('0x') || t.length !== 66) return '';
  return '0x' + t.slice(26);
}

async function rpcCall(method, params){
  const r = await fetch(CFG.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if(!r.ok) throw new Error('RPC HTTP ' + r.status);
  const j = await r.json();
  if (j?.error) throw new Error(j.error.message || 'RPC error');
  return j?.result;
}

async function getPairTokens(pairAddress){
  // cache per session
  if (mem?.pairTokens?.pair === pairAddress && mem?.pairTokens?.token0 && mem?.pairTokens?.token1) {
    return mem.pairTokens;
  }
  const call = async (sig) => {
    const res = await rpcCall('eth_call', [{ to: pairAddress, data: sig }, 'latest']);
    // last 20 bytes
    const h = String(res || '0x').toLowerCase();
    return (h.length >= 66) ? ('0x' + h.slice(h.length - 40)) : '';
  };
  const token0 = await call(SIG_TOKEN0);
  const token1 = await call(SIG_TOKEN1);
  mem.pairTokens = { pair: pairAddress, token0, token1 };
  return mem.pairTokens;
}

async function fetchOnChainSwaps(pairAddress, limit){
  const tokenAddr = (await resolveTokenAddress()).toLowerCase();
  const { token0, token1 } = await getPairTokens(pairAddress);
  const t0 = (token0 || '').toLowerCase();
  const t1 = (token1 || '').toLowerCase();

  const latestHex = await rpcCall('eth_blockNumber', []);
  const latest = parseInt(String(latestHex), 16);
  const lookback = 18_000; // ~ 2.5 days on Ethereum (safe default)
  const fromBlock = Math.max(0, latest - lookback);

  const logs = await rpcCall('eth_getLogs', [{
    fromBlock: '0x' + fromBlock.toString(16),
    toBlock: 'latest',
    address: pairAddress,
    topics: [UNISWAP_V2_SWAP_TOPIC0],
  }]);

  // newest first
  const recent = Array.isArray(logs) ? logs.slice(-Math.max(50, limit * 6)).reverse() : [];

  async function blockToMs(blockNumberHex){
    const key = String(blockNumberHex || '').toLowerCase();
    if (!key) return now();
    if (__blockTsCache.has(key)) return __blockTsCache.get(key);
    try{
      const blk = await rpcCall('eth_getBlockByNumber', [key, false]);
      const ts = parseInt(String(blk?.timestamp || '0x0'), 16);
      const ms = Number.isFinite(ts) ? (ts * 1000) : now();
      __blockTsCache.set(key, ms);
      return ms;
    }catch{
      const ms = now();
      __blockTsCache.set(key, ms);
      return ms;
    }
  }

  const out = [];
  for (const log of recent){
    const data = log?.data;
    const a0In = wordToBigInt(data, 0);
    const a1In = wordToBigInt(data, 1);
    const a0Out = wordToBigInt(data, 2);
    const a1Out = wordToBigInt(data, 3);

    // determine base token (CAPI) side if we know token address
    let side = '';
    if (tokenAddr && (tokenAddr === t0 || tokenAddr === t1)){
      const capiIs0 = tokenAddr === t0;
      const capiIn = capiIs0 ? a0In : a1In;
      const capiOut = capiIs0 ? a0Out : a1Out;
      // If user receives CAPI (capiOut > 0) it's a BUY (buying CAPI)
      if (capiOut > 0n) side = 'BUY';
      else if (capiIn > 0n) side = 'SELL';
    }

    const maker = topicToAddress(log?.topics?.[1]); // sender
    const txHash = String(log?.transactionHash || '');

    const tsMs = await blockToMs(log?.blockNumber);

    out.push({
      ts: tsMs,
      side,
      amountUsd: null, // we can approximate using priceUsd from snapshot if needed
      priceUsd: null,
      maker,
      txHash,
    });
    if (out.length >= limit) break;
  }
  return out;
}

function marketHealthFrom(pair, swaps){
  // DexScreener provides pairCreatedAt (ms). Early launch gets gentler scoring.
  const createdAt = Number(pair?.pairCreatedAt ?? NaN);
  const isEarlyLaunch = Number.isFinite(createdAt)
    ? (now() - createdAt) < (72 * 60 * 60 * 1000)
    : false;

  const liquidityUsd = Number(pair?.liquidity?.usd ?? NaN);
  const volumeH24 = Number(pair?.volume?.h24 ?? NaN);
  const txns = pair?.txns?.h24 || {};
  const buys = Number(txns?.buys ?? NaN);
  const sells = Number(txns?.sells ?? NaN);

  const buySellRatio = (Number.isFinite(buys) && Number.isFinite(sells))
    ? (sells === 0 ? Infinity : buys / sells)
    : null;

  const slip1k = estimateSlippagePct(1000, liquidityUsd);

  // Score (0–100)
  // - Normal mode: conservative
  // - Early launch mode: gentler penalties so it doesn't scream RISK on hour 1
  let score = isEarlyLaunch ? 55 : 50;
  const flags = [];

  if (Number.isFinite(liquidityUsd)){
    if (liquidityUsd >= 500_000) score += 20;
    else if (liquidityUsd >= 100_000) score += 12;
    else if (liquidityUsd >= 25_000) score += 5;
    else {
      score -= (isEarlyLaunch ? 4 : 10);
      flags.push('LOW_LIQUIDITY');
    }
  } else {
    score -= (isEarlyLaunch ? 4 : 10);
    flags.push('LIQUIDITY_UNKNOWN');
  }

  if (Number.isFinite(volumeH24)){
    if (volumeH24 >= 1_000_000) score += 12;
    else if (volumeH24 >= 250_000) score += 8;
    else if (volumeH24 >= 50_000) score += 4;
    else {
      score -= (isEarlyLaunch ? 2 : 6);
      flags.push('LOW_VOLUME');
    }
  } else {
    score -= (isEarlyLaunch ? 2 : 6);
    flags.push('VOLUME_UNKNOWN');
  }

  if (Number.isFinite(slip1k)){
    if (slip1k < 1) score += 10;
    else if (slip1k < 3) score += 6;
    else if (slip1k < 6) score += 1;
    else {
      score -= (isEarlyLaunch ? 4 : 10);
      flags.push('HIGH_SLIPPAGE');
    }
  } else {
    score -= (isEarlyLaunch ? 2 : 4);
    flags.push('SLIPPAGE_UNKNOWN');
  }

  if (buySellRatio !== null){
    if (buySellRatio > 1.3) score += 6;
    else if (buySellRatio > 0.8) score += 2;
    else {
      score -= (isEarlyLaunch ? 3 : 6);
      flags.push('SELL_PRESSURE');
    }
  } else {
    flags.push('TXNS_UNKNOWN');
  }

  // LP lock / holders are placeholders until you wire a registry/lock provider
  const lp = { locked: null, lockProvider: null, lockPct: 0 };
  flags.push('LP_LOCK_UNKNOWN');

  score = Math.max(0, Math.min(100, score));

  // Floor score during early launch unless *extremely* illiquid.
  const extremeEarly = isEarlyLaunch && (
    (Number.isFinite(liquidityUsd) && liquidityUsd < 200) &&
    (Number.isFinite(slip1k) && slip1k >= 30) &&
    (Number.isFinite(volumeH24) && volumeH24 < 10)
  );
  if (isEarlyLaunch && !extremeEarly) score = Math.max(score, 45);

  let label = 'CAUTION';
  if (isEarlyLaunch) {
    label = score >= 70 ? 'HEALTHY' : 'TRUST BUILDING';
  } else {
    if (score >= 80) label = 'HEALTHY';
    else if (score >= 55) label = 'CAUTION';
    else if (score >= 35) label = 'CAUTION';
    else label = 'RISK';
  }

  // Boost for Trust Engine (0..15)
  const healthBoost = Math.max(0, Math.min(15, Math.round((score - (isEarlyLaunch ? 55 : 50)) / 3)));

  return {
    liquidityUsd: Number.isFinite(liquidityUsd) ? liquidityUsd : null,
    volumeH24: Number.isFinite(volumeH24) ? volumeH24 : null,
    txns24h: {
      buys: Number.isFinite(buys) ? buys : null,
      sells: Number.isFinite(sells) ? sells : null,
    },
    buySellRatio,
    slippageEst: {
      buy1kPct: slip1k,
    },
    lp,
    marketHealthScore: score,
    marketHealthLabel: label,
    healthBoost,
    isEarlyLaunch,
    healthFlags: flags,
  };
}

export async function getMarketSnapshot(){
  // Memory cache
  if (mem.snapshot && isFresh(mem.snapshotAt, CFG.ttlMs)) return mem.snapshot;

  // localStorage cache
  const ls = lsGet('capitoken:market:snapshot');
  if (ls?.data && isFresh(ls?.ts, CFG.ttlMs)){
    mem.snapshot = ls.data;
    mem.snapshotAt = ls.ts;
    return ls.data;
  }

  const pairAddress = await resolvePairAddress();
  if (!pairAddress) {
    const empty = {
      liquidityUsd: null,
      volumeH24: null,
      txns24h: { buys: null, sells: null },
      buySellRatio: null,
      slippageEst: { buy1kPct: null },
      lp: { locked: null, lockProvider: null, lockPct: 0 },
      marketHealthScore: null,
      marketHealthLabel: 'PENDING',
      healthFlags: ['PAIR_NOT_SET'],
    };
    mem.snapshot = empty;
    mem.snapshotAt = now();
    return empty;
  }

  const url = `https://api.dexscreener.com/latest/dex/pairs/ethereum/${pairAddress}`;
  const j = await fetchJson(url);
  const pair = Array.isArray(j?.pairs) ? j.pairs[0] : null;
  const swaps = await getRecentSwaps(10).catch(()=>[]);
  const snap = marketHealthFrom(pair, swaps);

  mem.snapshot = snap;
  mem.snapshotAt = now();
  lsSet('capitoken:market:snapshot', { ts: mem.snapshotAt, data: snap });
  return snap;
}

export async function getRecentSwaps(limit = 10){
  // Memory cache
  if (mem.swaps && isFresh(mem.swapsAt, CFG.ttlMs)) return mem.swaps;

  // localStorage cache
  const ls = lsGet('capitoken:market:swaps');
  if (ls?.data && isFresh(ls?.ts, CFG.ttlMs)){
    mem.swaps = ls.data;
    mem.swapsAt = ls.ts;
    return ls.data;
  }

  const pairAddress = await resolvePairAddress();
  if (!pairAddress) return [];

  // Official DexScreener REST reference does not include a trades endpoint.
  // We use on-chain Uniswap V2 Swap logs instead.
  const out = await fetchOnChainSwaps(pairAddress, Math.max(0, Number(limit) || 10));

  mem.swaps = out;
  mem.swapsAt = now();
  lsSet('capitoken:market:swaps', { ts: mem.swapsAt, data: out });
  return out;
}
