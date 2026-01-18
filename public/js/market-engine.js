export const ENGINE_VERSION = (new URL(import.meta.url)).searchParams.get('v') || 'dev';
// [market-engine] PHASE94R3
// Phase 9.4 – Real Swap Activity + Market Health
// Snapshot: DexScreener pairs endpoint
// Swaps: on-chain Uniswap V2 Swap logs (eth_getLogs) with adaptive lookback + RPC fallback

const CFG = {
  baseUrl: '/',
  chain: 'ethereum',
  pairAddress: null,
  tokenAddress: null,
  rpcUrls: [
    'https://cloudflare-eth.com',
    'https://rpc.ankr.com/eth',
    'https://eth.llamarpc.com'
  ],
  cacheTtlMs: 60_000,
  // Expand lookback if no swaps found
  swapsLookbacks: [5000, 20000, 100000, 250000],
  // Early launch window to avoid harsh labeling
  earlyLaunchDays: 7,
};

const LS_SNAPSHOT = 'capitoken:market:snapshot';
const LS_SWAPS = 'capitoken:market:swaps';

let memSnapshot = null; // { ts, data }
let memSwaps = null; // { ts, data }

let token0Cache = null;
let token1Cache = null;
const blockTsCache = new Map(); // blockNumber -> tsMs

// Uniswap V2 Swap(address,uint256,uint256,uint256,uint256,address)
const UNIV2_SWAP_TOPIC0 = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';

export function setMarketConfig(opts = {}) {
  if (opts.baseUrl != null) CFG.baseUrl = String(opts.baseUrl);
  if (opts.chain != null) CFG.chain = String(opts.chain);
  if (opts.pairAddress != null) CFG.pairAddress = normAddr(opts.pairAddress);
  if (opts.tokenAddress != null) CFG.tokenAddress = normAddr(opts.tokenAddress);
  if (Array.isArray(opts.rpcUrls) && opts.rpcUrls.length) {
    CFG.rpcUrls = opts.rpcUrls.map(String);
  }
  if (Number.isFinite(opts.cacheTtlMs)) CFG.cacheTtlMs = Math.max(5_000, opts.cacheTtlMs);
  if (Number.isFinite(opts.earlyLaunchDays)) CFG.earlyLaunchDays = Math.max(1, opts.earlyLaunchDays);
}

export async function getMarketSnapshot() {
  const cached = readCache(LS_SNAPSHOT, memSnapshot);
  if (cached) return cached;

  const pairAddress = await resolvePairAddress();
  if (!pairAddress) {
    const empty = computeHealth({});
    writeCache(LS_SNAPSHOT, empty, (v) => { memSnapshot = v; });
    return empty;
  }

  const url = `https://api.dexscreener.com/latest/dex/pairs/ethereum/${pairAddress}`;
  const json = await safeFetchJson(url);
  const pair = json?.pair || (Array.isArray(json?.pairs) ? json.pairs[0] : null);

  const snapshot = {
    pairAddress,
    dexId: pair?.dexId || null,
    url: pair?.url || null,
    baseToken: {
      address: normAddr(pair?.baseToken?.address) || null,
      symbol: pair?.baseToken?.symbol || null,
      name: pair?.baseToken?.name || null,
    },
    quoteToken: {
      address: normAddr(pair?.quoteToken?.address) || null,
      symbol: pair?.quoteToken?.symbol || null,
      name: pair?.quoteToken?.name || null,
    },
    priceUsd: toNum(pair?.priceUsd),
    priceNative: toNum(pair?.priceNative),
    liquidityUsd: toNum(pair?.liquidity?.usd),
    volumeH24: toNum(pair?.volume?.h24),
    txns24h: {
      buys: toNum(pair?.txns?.h24?.buys),
      sells: toNum(pair?.txns?.h24?.sells),
    },
    fdv: toNum(pair?.fdv),
    marketCap: toNum(pair?.marketCap),
    priceChange24h: toNum(pair?.priceChange?.h24),
    pairCreatedAt: pair?.pairCreatedAt ? Number(pair.pairCreatedAt) : null,
    labels: Array.isArray(pair?.labels) ? pair.labels.slice(0, 5) : [],
  };

  const enriched = computeHealth(snapshot);
  writeCache(LS_SNAPSHOT, enriched, (v) => { memSnapshot = v; });
  return enriched;
}

export async function getRecentSwaps(limit = 10) {
  const cached = readCache(LS_SWAPS, memSwaps);
  if (cached) return cached.slice(0, limit);

  const pairAddress = await resolvePairAddress();
  if (!pairAddress) {
    writeCache(LS_SWAPS, [], (v) => { memSwaps = v; });
    return [];
  }

  // Ensure token0/token1 cached (needed for BUY/SELL side)
  await ensureTokenOrder(pairAddress);

  // Fetch latest price for USD estimation (best-effort)
  let snapshot = null;
  try { snapshot = await getMarketSnapshot(); } catch { snapshot = null; }
  const priceUsd = toNum(snapshot?.priceUsd);

  const latestBlock = await rpcCall('eth_blockNumber', []);
  const latestBn = hexToInt(latestBlock);
  if (!Number.isFinite(latestBn) || latestBn <= 0) {
    writeCache(LS_SWAPS, [], (v) => { memSwaps = v; });
    return [];
  }

  let logs = [];
  for (const lookback of CFG.swapsLookbacks) {
    const fromBn = Math.max(1, latestBn - lookback);
    logs = await getSwapLogs(pairAddress, fromBn, latestBn);
    if (logs && logs.length) break;
  }

  if (!logs || logs.length === 0) {
    // Soft-fail: no swaps visible via RPC/logs (but don’t break UI)
    writeCache(LS_SWAPS, [], (v) => { memSwaps = v; });
    return [];
  }

  // Normalize logs to swaps (newest first)
  const swaps = [];
  for (let i = logs.length - 1; i >= 0 && swaps.length < Math.max(50, limit * 5); i--) {
    const lg = logs[i];
    const swap = await decodeUniV2SwapLog(lg, snapshot, priceUsd);
    if (swap) swaps.push(swap);
  }

  writeCache(LS_SWAPS, swaps, (v) => { memSwaps = v; });
  return swaps.slice(0, limit);
}

// ---------------------------
// Health scoring (early launch friendly)
// ---------------------------

function computeHealth(s) {
  const liquidityUsd = toNum(s?.liquidityUsd);
  const volumeH24 = toNum(s?.volumeH24);
  const buys = toNum(s?.txns24h?.buys);
  const sells = toNum(s?.txns24h?.sells);

  // Slippage estimate (very rough): 1k USD vs liquidity depth
  const slip = estimateSlippagePct(liquidityUsd, 1000);

  const now = Date.now();
  const createdAt = Number.isFinite(s?.pairCreatedAt) ? s.pairCreatedAt : null;
  const isEarlyLaunch = createdAt ? (now - createdAt) < (CFG.earlyLaunchDays * 24 * 3600 * 1000) : false;

  const flags = [];
  if (!Number.isFinite(liquidityUsd) || liquidityUsd <= 0) flags.push('LOW_LIQUIDITY');
  else if (liquidityUsd < 5_000) flags.push('LOW_LIQUIDITY');

  if (!Number.isFinite(volumeH24) || volumeH24 < 50) flags.push('LOW_VOLUME');
  if (Number.isFinite(slip) && slip >= 5) flags.push('HIGH_SLIPPAGE');

  const buySellRatio = (buys + sells) > 0 ? (buys / Math.max(1, sells)) : 0;

  // Score base 0..100
  let score = 60;
  // Liquidity contribution
  if (Number.isFinite(liquidityUsd)) {
    if (liquidityUsd < 1_000) score -= isEarlyLaunch ? 8 : 20;
    else if (liquidityUsd < 5_000) score -= isEarlyLaunch ? 4 : 10;
    else if (liquidityUsd < 25_000) score += 2;
    else score += 6;
  } else {
    score -= isEarlyLaunch ? 6 : 12;
  }
  // Volume contribution
  if (Number.isFinite(volumeH24)) {
    if (volumeH24 < 10) score -= isEarlyLaunch ? 6 : 14;
    else if (volumeH24 < 100) score -= isEarlyLaunch ? 3 : 8;
    else if (volumeH24 > 5_000) score += 6;
  }
  // Slippage contribution
  if (Number.isFinite(slip)) {
    if (slip >= 20) score -= isEarlyLaunch ? 6 : 18;
    else if (slip >= 10) score -= isEarlyLaunch ? 4 : 12;
    else if (slip >= 5) score -= isEarlyLaunch ? 2 : 6;
    else score += 4;
  }
  // Buy/sell
  if (Number.isFinite(buySellRatio)) {
    if (buySellRatio > 1.2) score += 2;
    else if (buySellRatio < 0.8) score -= 2;
  }

  score = clamp(score, 0, 100);

  // Labeling (early launch friendly)
  let label = 'CAUTION';
  if (isEarlyLaunch) {
    label = score >= 55 ? 'TRUST BUILDING' : 'EARLY LAUNCH';
  } else {
    label = score >= 75 ? 'HEALTHY' : (score >= 50 ? 'CAUTION' : 'RISK');
  }

  // Market health boost 0..15 used by trust-engine
  // Avoid huge swings early.
  const boost = clamp(Math.round((score - 50) / 3), 0, 15);

  return {
    ...s,
    slippageEst: { buy1kPct: slip },
    buySellRatio,
    marketHealthScore: score,
    marketHealthLabel: label,
    healthBoost: boost,
    healthFlags: uniq(flags),
    isEarlyLaunch,
    // LP info left as unknown unless you wire a lock registry
    lp: s?.lp || { locked: null, lockProvider: null, lockPct: 0 },
  };
}

function estimateSlippagePct(liquidityUsd, tradeUsd) {
  const L = toNum(liquidityUsd);
  const T = toNum(tradeUsd);
  if (!Number.isFinite(L) || L <= 0 || !Number.isFinite(T) || T <= 0) return null;
  // Very rough heuristic: slippage ~ trade / (2 * liquidity)
  return clamp((T / (2 * L)) * 100, 0, 99);
}

// ---------------------------
// On-chain swaps (Uniswap V2)
// ---------------------------

async function resolvePairAddress() {
  if (CFG.pairAddress) return CFG.pairAddress;
  // Try registry if present
  try {
    const regUrl = `${CFG.baseUrl}official-registry.json`;
    const reg = await safeFetchJson(regUrl);
    const p = normAddr(reg?.dexPair?.address || reg?.pairAddress || reg?.pair || null);
    if (p) CFG.pairAddress = p;
    const t = normAddr(reg?.token?.address || reg?.tokenAddress || null);
    if (t) CFG.tokenAddress = t;
    return p;
  } catch {
    return null;
  }
}

async function ensureTokenOrder(pairAddress) {
  if (token0Cache && token1Cache) return;
  // Uniswap V2 pair ABI selectors
  const TOKEN0_SIG = '0x0dfe1681'; // token0()
  const TOKEN1_SIG = '0xd21220a7'; // token1()

  try {
    const r0 = await rpcCall('eth_call', [{ to: pairAddress, data: TOKEN0_SIG }, 'latest']);
    const r1 = await rpcCall('eth_call', [{ to: pairAddress, data: TOKEN1_SIG }, 'latest']);
    token0Cache = decodeAddrFrom32(r0);
    token1Cache = decodeAddrFrom32(r1);
  } catch {
    // leave caches null; decoding will still work, but side may be UNKNOWN
  }
}

async function getSwapLogs(pairAddress, fromBn, toBn) {
  const params = [{
    address: pairAddress,
    fromBlock: intToHex(fromBn),
    toBlock: intToHex(toBn),
    topics: [UNIV2_SWAP_TOPIC0],
  }];
  try {
    const logs = await rpcCall('eth_getLogs', params);
    return Array.isArray(logs) ? logs : [];
  } catch {
    return [];
  }
}

async function decodeUniV2SwapLog(log, snapshot, priceUsd) {
  try {
    const data = String(log?.data || '');
    if (!data.startsWith('0x') || data.length < 2 + 64 * 4) return null;

    const amounts = decode4xUint256(data);
    const amount0In = amounts[0];
    const amount1In = amounts[1];
    const amount0Out = amounts[2];
    const amount1Out = amounts[3];

    const bn = hexToInt(log.blockNumber);
    const ts = await getBlockTimestampMs(bn);

    const txHash = log.transactionHash || null;

    // topics: [topic0, sender, to]
    const maker = log.topics && log.topics[1] ? decodeAddrFromTopic(log.topics[1]) : null;

    // Determine base token and token0/token1
    const baseAddr = normAddr(snapshot?.baseToken?.address) || CFG.tokenAddress;
    const t0 = token0Cache;
    const t1 = token1Cache;

    let side = 'UNKNOWN';
    let baseAmountRaw = null;

    if (baseAddr && t0 && t1) {
      if (baseAddr === t0) {
        // base is token0
        if (amount0Out > 0n) { side = 'BUY'; baseAmountRaw = amount0Out; }
        else if (amount0In > 0n) { side = 'SELL'; baseAmountRaw = amount0In; }
      } else if (baseAddr === t1) {
        // base is token1
        if (amount1Out > 0n) { side = 'BUY'; baseAmountRaw = amount1Out; }
        else if (amount1In > 0n) { side = 'SELL'; baseAmountRaw = amount1In; }
      }
    } else {
      // Fallback: infer direction by which out leg is non-zero
      if (amount0Out > 0n || amount1Out > 0n) side = 'BUY';
      else if (amount0In > 0n || amount1In > 0n) side = 'SELL';
    }

    // Amount token + USD estimation (best-effort)
    // We do NOT know decimals here without token calls; approximate with 18 decimals.
    // For your CAPI token, if decimals != 18, you can wire registry.decimals and use it.
    const decimals = 18;
    const amountToken = baseAmountRaw != null ? bigToFloat(baseAmountRaw, decimals) : null;
    const amountUsd = (Number.isFinite(priceUsd) && Number.isFinite(amountToken)) ? amountToken * priceUsd : null;

    return {
      ts: ts || Date.now(),
      side,
      amountUsd,
      amountToken,
      priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
      maker,
      txHash,
      blockNumber: bn || null,
    };
  } catch {
    return null;
  }
}

async function getBlockTimestampMs(blockNumber) {
  if (!Number.isFinite(blockNumber)) return null;
  if (blockTsCache.has(blockNumber)) return blockTsCache.get(blockNumber);
  try {
    const blk = await rpcCall('eth_getBlockByNumber', [intToHex(blockNumber), false]);
    const tsSec = hexToInt(blk?.timestamp);
    if (!Number.isFinite(tsSec)) return null;
    const tsMs = tsSec * 1000;
    blockTsCache.set(blockNumber, tsMs);
    // Prevent unbounded growth
    if (blockTsCache.size > 500) {
      const firstKey = blockTsCache.keys().next().value;
      blockTsCache.delete(firstKey);
    }
    return tsMs;
  } catch {
    return null;
  }
}

// ---------------------------
// RPC + HTTP helpers
// ---------------------------

async function rpcCall(method, params) {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method,
    params,
  };
  let lastErr = null;
  for (const url of CFG.rpcUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        lastErr = new Error(`RPC ${method} failed: ${res.status}`);
        continue;
      }
      const json = await res.json();
      if (json?.error) {
        lastErr = new Error(json.error?.message || 'RPC error');
        continue;
      }
      return json?.result;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('RPC failed');
}

async function safeFetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

// ---------------------------
// Cache
// ---------------------------

function readCache(lsKey, mem) {
  const now = Date.now();
  if (mem && mem.ts && (now - mem.ts) < CFG.cacheTtlMs) return mem.data;
  try {
    const raw = localStorage.getItem(lsKey);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.ts || (now - obj.ts) >= CFG.cacheTtlMs) return null;
    return obj.data;
  } catch {
    return null;
  }
}

function writeCache(lsKey, data, setMem) {
  const obj = { ts: Date.now(), data };
  try { localStorage.setItem(lsKey, JSON.stringify(obj)); } catch {}
  if (setMem) setMem(obj);
}

// ---------------------------
// Utils
// ---------------------------

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function clamp(n, a, b) {
  const x = Number(n);
  if (!Number.isFinite(x)) return a;
  return Math.min(b, Math.max(a, x));
}

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    if (!x || seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function normAddr(a) {
  if (!a || typeof a !== 'string') return null;
  const s = a.trim();
  if (!s) return null;
  // Accept already-lowercased
  if (s.startsWith('0x') && s.length === 42) return s.toLowerCase();
  return null;
}

function hexToInt(hex) {
  if (typeof hex !== 'string' || !hex.startsWith('0x')) return NaN;
  try { return parseInt(hex, 16); } catch { return NaN; }
}

function intToHex(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return '0x0';
  return '0x' + Math.trunc(x).toString(16);
}

function decodeAddrFrom32(hex) {
  if (typeof hex !== 'string' || !hex.startsWith('0x') || hex.length < 66) return null;
  // last 20 bytes
  const h = hex.slice(-40);
  return ('0x' + h).toLowerCase();
}

function decodeAddrFromTopic(topic) {
  if (typeof topic !== 'string' || !topic.startsWith('0x') || topic.length !== 66) return null;
  return ('0x' + topic.slice(26)).toLowerCase();
}

function decode4xUint256(dataHex) {
  // returns [a,b,c,d] as BigInt
  const hex = dataHex.startsWith('0x') ? dataHex.slice(2) : dataHex;
  const out = [];
  for (let i = 0; i < 4; i++) {
    const chunk = hex.slice(i * 64, (i + 1) * 64);
    out.push(BigInt('0x' + chunk));
  }
  return out;
}

function bigToFloat(bi, decimals) {
  try {
    const s = bi.toString(10);
    if (decimals <= 0) return Number(s);
    if (s.length <= decimals) {
      const pad = '0'.repeat(decimals - s.length + 1);
      const full = pad + s;
      const intPart = '0';
      const fracPart = full.slice(-decimals);
      return Number(`${intPart}.${fracPart}`);
    }
    const intPart = s.slice(0, s.length - decimals);
    const fracPart = s.slice(-decimals);
    // Limit precision to avoid huge floats
    const fracTrim = fracPart.slice(0, 6);
    return Number(`${intPart}.${fracTrim}`);
  } catch {
    return null;
  }
}
