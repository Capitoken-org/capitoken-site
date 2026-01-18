/* Capitoken – Phase 9.4: Market Engine
   - DexScreener swaps + market health snapshot
   - Safe for GitHub Pages (no absolute paths)
   - Cache TTL 60s
*/

const DEFAULT_TTL = 60_000;

let CFG = {
  baseUrl: null,
  pairAddress: null,
  ttlMs: DEFAULT_TTL,
};

let mem = {
  snapshot: null,
  snapshotAt: 0,
  swaps: null,
  swapsAt: 0,
};

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

async function resolvePairAddress(){
  if (CFG.pairAddress) return String(CFG.pairAddress);
  try{
    const reg = await loadRegistry();
    const p = reg?.pair?.address || '';
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

function marketHealthFrom(pair, swaps){
  const liquidityUsd = Number(pair?.liquidity?.usd ?? NaN);
  const volumeH24 = Number(pair?.volume?.h24 ?? NaN);
  const txns = pair?.txns?.h24 || {};
  const buys = Number(txns?.buys ?? NaN);
  const sells = Number(txns?.sells ?? NaN);

  const buySellRatio = (Number.isFinite(buys) && Number.isFinite(sells))
    ? (sells === 0 ? Infinity : buys / sells)
    : null;

  const slip1k = estimateSlippagePct(1000, liquidityUsd);

  // Score (0–100) – conservative, early-launch friendly
  let score = 50;
  const flags = [];

  if (Number.isFinite(liquidityUsd)){
    if (liquidityUsd >= 500_000) score += 20;
    else if (liquidityUsd >= 100_000) score += 12;
    else if (liquidityUsd >= 25_000) score += 5;
    else { score -= 10; flags.push('LOW_LIQUIDITY'); }
  } else {
    score -= 10;
    flags.push('LIQUIDITY_UNKNOWN');
  }

  if (Number.isFinite(volumeH24)){
    if (volumeH24 >= 1_000_000) score += 12;
    else if (volumeH24 >= 250_000) score += 8;
    else if (volumeH24 >= 50_000) score += 4;
    else { score -= 6; flags.push('LOW_VOLUME'); }
  } else {
    score -= 6;
    flags.push('VOLUME_UNKNOWN');
  }

  if (Number.isFinite(slip1k)){
    if (slip1k < 1) score += 10;
    else if (slip1k < 3) score += 6;
    else if (slip1k < 6) score += 1;
    else { score -= 10; flags.push('HIGH_SLIPPAGE'); }
  } else {
    score -= 4;
    flags.push('SLIPPAGE_UNKNOWN');
  }

  if (buySellRatio !== null){
    if (buySellRatio > 1.3) score += 6;
    else if (buySellRatio > 0.8) score += 2;
    else { score -= 6; flags.push('SELL_PRESSURE'); }
  } else {
    flags.push('TXNS_UNKNOWN');
  }

  // LP lock / holders are placeholders until you wire a registry/lock provider
  const lp = { locked: null, lockProvider: null, lockPct: 0 };
  flags.push('LP_LOCK_UNKNOWN');

  score = Math.max(0, Math.min(100, score));

  let label = 'CAUTION';
  if (score >= 80) label = 'HEALTHY';
  else if (score >= 55) label = 'EARLY LAUNCH';
  else if (score >= 35) label = 'CAUTION';
  else label = 'RISK';

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

  const url = `https://api.dexscreener.com/latest/dex/trades/ethereum/${pairAddress}`;
  const j = await fetchJson(url);
  const trades = Array.isArray(j?.trades) ? j.trades : (Array.isArray(j?.data) ? j.data : []);

  const out = trades.map(normalizeTrade).filter(x => x && x.side).slice(0, Math.max(0, Number(limit) || 10));

  mem.swaps = out;
  mem.swapsAt = now();
  lsSet('capitoken:market:swaps', { ts: mem.swapsAt, data: out });
  return out;
}
