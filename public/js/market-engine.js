// market-engine.js (PHASE94R26_ONCHAIN)
// Recent swaps pulled from Uniswap V2 Swap logs via RPC (eth_getLogs).

export const ENGINE_VERSION = (() => {
  try { return new URL(import.meta.url).searchParams.get('v') || 'PHASE94R26_ONCHAIN'; }
  catch { return 'PHASE94R26_ONCHAIN'; }
})();

const STATE = { baseUrl: '/', cache: { registry: null, ts: 0 }, blockTs: new Map(), token0: null, token1: null };

export function setMarketConfig(cfg = {}) {
  STATE.baseUrl = cfg.baseUrl || '/';
}

function cfgRuntime() {
  const c = (typeof window !== 'undefined' && window.CAPI_CONFIG) ? window.CAPI_CONFIG : {};
  const rpc = c.RPC_HTTP || window.CAPI_RPC_HTTP || '';
  const contract = c.CONTRACT_ADDRESS || '';
  return { rpc, contract };
}

async function rpcCall(url, method, params = []) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

function pad32(h) { return h.padStart(64, '0'); }
function addrToWord(addr) { return pad32(addr.replace(/^0x/, '').toLowerCase()); }
function hexToBigInt(h) { return (!h || h === '0x') ? 0n : BigInt(h); }
function bigToNum(bi, dec = 18) {
  const s = bi.toString();
  if (dec === 0) return Number(s);
  const neg = s.startsWith('-');
  const t = neg ? s.slice(1) : s;
  const pad = t.padStart(dec + 1, '0');
  const intPart = pad.slice(0, -dec);
  const fracPart = pad.slice(-dec).replace(/0+$/, '');
  const out = fracPart ? `${intPart}.${fracPart}` : intPart;
  return Number(neg ? `-${out}` : out);
}

// UniswapV2Pair Swap event signature hash
const UNIV2_SWAP_TOPIC = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';

// Function selectors (4 bytes)
const SEL_TOKEN0 = '0x0dfe1681'; // token0()
const SEL_TOKEN1 = '0xd21220a7'; // token1()
const SEL_LATEST_ROUND = '0xfeaf968c'; // latestRoundData()

// Chainlink ETH/USD feed (mainnet)
const CHAINLINK_ETH_USD = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';

async function getRegistry(baseUrl) {
  const now = Date.now();
  if (STATE.cache.registry && (now - STATE.cache.ts) < 60_000) return STATE.cache.registry;
  const url = `${baseUrl.replace(/\/$/, '')}/official-registry.json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('official-registry.json not found');
  const j = await res.json();
  STATE.cache.registry = j;
  STATE.cache.ts = now;
  return j;
}

async function ensureTokenOrder(rpcUrl, pairAddr) {
  if (STATE.token0 && STATE.token1) return;
  const t0 = await rpcCall(rpcUrl, 'eth_call', [{ to: pairAddr, data: SEL_TOKEN0 }, 'latest']);
  const t1 = await rpcCall(rpcUrl, 'eth_call', [{ to: pairAddr, data: SEL_TOKEN1 }, 'latest']);
  STATE.token0 = `0x${t0.slice(-40)}`.toLowerCase();
  STATE.token1 = `0x${t1.slice(-40)}`.toLowerCase();
}

async function getEthUsd(rpcUrl) {
  // latestRoundData() returns: (uint80,int256,uint256,uint256,uint80)
  // We only need answer (int256) which is 2nd return word.
  const data = SEL_LATEST_ROUND;
  const out = await rpcCall(rpcUrl, 'eth_call', [{ to: CHAINLINK_ETH_USD, data }, 'latest']);
  const hex = out.replace(/^0x/, '').padStart(64 * 5, '0');
  const answerHex = hex.slice(64, 128);
  const ans = BigInt(`0x${answerHex}`);
  // Chainlink ETH/USD has 8 decimals
  return Number(ans) / 1e8;
}

function decodeSwapData(data) {
  const hex = data.replace(/^0x/, '');
  const w = (i) => hex.slice(i * 64, (i + 1) * 64);
  const amount0In = BigInt(`0x${w(0)}`);
  const amount1In = BigInt(`0x${w(1)}`);
  const amount0Out = BigInt(`0x${w(2)}`);
  const amount1Out = BigInt(`0x${w(3)}`);
  return { amount0In, amount1In, amount0Out, amount1Out };
}

function shortAddr(a) {
  if (!a || a.length < 10) return a || '';
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

async function blockTimestampMs(rpcUrl, blockNumberHex) {
  const bn = Number(blockNumberHex);
  if (STATE.blockTs.has(bn)) return STATE.blockTs.get(bn);
  const blk = await rpcCall(rpcUrl, 'eth_getBlockByNumber', [blockNumberHex, false]);
  const ts = Number(hexToBigInt(blk.timestamp)) * 1000;
  STATE.blockTs.set(bn, ts);
  return ts;
}

export async function getRecentSwaps(limit = 10) {
  const { rpc: rpcUrl } = cfgRuntime();
  if (!rpcUrl) throw new Error('RPC not configured');

  const registry = await getRegistry(STATE.baseUrl);
  const pairAddr = (registry && registry.dex && registry.dex.pair) ? registry.dex.pair.toLowerCase() : null;
  const tokenAddr = (registry && registry.contract && registry.contract.address) ? registry.contract.address.toLowerCase() : null;
  const wethAddr = (registry && registry.dex && registry.dex.weth) ? registry.dex.weth.toLowerCase() : '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

  if (!pairAddr || !tokenAddr) return [];

  await ensureTokenOrder(rpcUrl, pairAddr);
  const ethUsd = await getEthUsd(rpcUrl).catch(() => 0);

  const latestHex = await rpcCall(rpcUrl, 'eth_blockNumber', []);
  const latest = Number(hexToBigInt(latestHex));
  const fromBlock = Math.max(0, latest - 20_000);

  const logs = await rpcCall(rpcUrl, 'eth_getLogs', [{
    fromBlock: '0x' + fromBlock.toString(16),
    toBlock: 'latest',
    address: pairAddr,
    topics: [UNIV2_SWAP_TOPIC]
  }]);

  // newest first
  logs.sort((a, b) => Number(hexToBigInt(b.blockNumber)) - Number(hexToBigInt(a.blockNumber)));

  const out = [];
  for (const log of logs) {
    const { amount0In, amount1In, amount0Out, amount1Out } = decodeSwapData(log.data);

    // Determine which token is WETH based on token0/token1.
    const t0 = STATE.token0;
    const t1 = STATE.token1;

    const isWeth0 = t0 === wethAddr;
    const wethIn = isWeth0 ? amount0In : amount1In;
    const wethOut = isWeth0 ? amount0Out : amount1Out;

    const tokenIn = (!isWeth0) ? amount0In : amount1In;
    const tokenOut = (!isWeth0) ? amount0Out : amount1Out;

    // Buy: WETH in, token out. Sell: token in, WETH out.
    const isBuy = wethIn > 0n && tokenOut > 0n;
    const isSell = tokenIn > 0n && wethOut > 0n;

    if (!isBuy && !isSell) continue;

    const wethAmt = bigToNum(isBuy ? wethIn : wethOut, 18);
    const tokenAmt = bigToNum(isBuy ? tokenOut : tokenIn, 18);

    const priceWeth = tokenAmt > 0 ? (wethAmt / tokenAmt) : 0;
    const priceUsd = ethUsd > 0 ? priceWeth * ethUsd : 0;

    const usd = ethUsd > 0 ? (wethAmt * ethUsd) : 0;

    const senderTopic = (log.topics && log.topics[1]) ? `0x${log.topics[1].slice(-40)}` : '';

    out.push({
      ts: await blockTimestampMs(rpcUrl, log.blockNumber),
      side: isBuy ? 'Buy' : 'Sell',
      usd,
      price: priceUsd,
      maker: shortAddr(senderTopic.toLowerCase()),
      tx: log.transactionHash
    });

    if (out.length >= limit) break;
  }

  return out;
}

/* =========================================================
   CAPI Pulse (DexScreener)
   - Fills #mPrice #mMcap #mLiq #mVol #pulseBS #pulseAge
   - Safe: never throws, never breaks layout, keeps TBA/— on failure.
   ========================================================= */

function pickPairFromRegistry(reg) {
  // Supported schemas (keep backward compatibility):
  // 1) reg.dex.pair
  // 2) reg.pair.address
  // 3) reg.links.market (parse pair from URL)
  try {
    if (reg?.dex?.pair) return String(reg.dex.pair);
    if (reg?.pair?.address) return String(reg.pair.address);
    const m = reg?.links?.market ? String(reg.links.market) : '';
    const mm = m.match(/dexscreener\.com\/ethereum\/(0x[a-fA-F0-9]{40})/);
    if (mm) return mm[1];
  } catch {}
  return '';
}

function fmtCompactUsd(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return 'TBA';
  const abs = Math.abs(num);
  const units = [
    { v: 1e12, s: 'T' },
    { v: 1e9,  s: 'B' },
    { v: 1e6,  s: 'M' },
    { v: 1e3,  s: 'K' },
  ];
  for (const u of units) {
    if (abs >= u.v) return '$' + (num / u.v).toFixed(2).replace(/\.00$/, '') + u.s;
  }
  return '$' + num.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function fmtPriceUsd(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return 'TBA';
  if (num >= 1) return '$' + num.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  // keep small prices readable
  return '$' + num.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
}

function fmtPlain(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return 'TBA';
  return '$' + num.toFixed(2).replace(/\.00$/, '');
}

function fmtAge(msOrIsoOrSec) {
  try {
    let createdMs = 0;
    if (typeof msOrIsoOrSec === 'number') {
      createdMs = msOrIsoOrSec > 1e12 ? msOrIsoOrSec : (msOrIsoOrSec * 1000);
    } else {
      const s = String(msOrIsoOrSec || '').trim();
      if (!s) return '—';
      const asNum = Number(s);
      if (Number.isFinite(asNum) && asNum > 0) createdMs = asNum > 1e12 ? asNum : asNum * 1000;
      else createdMs = Date.parse(s);
    }
    if (!createdMs || !Number.isFinite(createdMs)) return '—';
    const delta = Math.max(0, Date.now() - createdMs);
    const mins = Math.floor(delta / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days >= 1) return `${days}d`;
    if (hrs >= 1) return `${hrs}h`;
    if (mins >= 1) return `${mins}m`;
    return 'just now';
  } catch {
    return '—';
  }
}

function setText(id, v) {
  try {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  } catch {}
}

function setHref(id, url) {
  try {
    const el = document.getElementById(id);
    if (el && url) el.setAttribute('href', url);
  } catch {}
}

// Discreet status line for the Pulse card (cosmetic only).
// We inject it dynamically to avoid touching Astro/HTML.
function ensurePulseStatusEl() {
  try {
    if (typeof document === 'undefined') return null;
    let el = document.getElementById('pulseStatus');
    if (el) return el;

    // Find a safe anchor inside the CAPI Pulse card
    const priceEl = document.getElementById('mPrice');
    const card = priceEl?.closest?.('.card');
    if (!card) return null;

    const stats = card.querySelector('.stats');
    if (!stats) return null;

    el = document.createElement('div');
    el.id = 'pulseStatus';
    el.className = 'small';
    el.setAttribute('aria-live', 'polite');
    el.style.marginTop = '10px';
    el.style.opacity = '0.72';

    // Insert right after the stats list (clean + discreet)
    stats.insertAdjacentElement('afterend', el);
    return el;
  } catch {
    return null;
  }
}

function setPulseStatus(text) {
  try {
    const el = ensurePulseStatusEl();
    if (!el) return;
    el.textContent = text || '';
  } catch {}
}

async function fetchDexScreenerPair({ apiBase, chain, pair, timeoutMs }) {
  const url = `${String(apiBase).replace(/\/$/, '')}/${encodeURIComponent(chain)}/${encodeURIComponent(pair)}`;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => { try { ctrl?.abort(); } catch {} }, Math.max(1000, Number(timeoutMs) || 6500));
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl?.signal });
    if (!res.ok) throw new Error('dexscreener fetch failed');
    const j = await res.json();
    const p = (j && Array.isArray(j.pairs) && j.pairs[0]) ? j.pairs[0] : null;
    if (!p) throw new Error('dexscreener no pair');
    return p;
  } finally {
    clearTimeout(t);
  }
}

function updatePulseFromPair(pairObj) {
  try {
    const priceUsd = pairObj?.priceUsd;
    const liqUsd = pairObj?.liquidity?.usd;
    const vol24 = pairObj?.volume?.h24;
    const buys = pairObj?.txns?.h24?.buys;
    const sells = pairObj?.txns?.h24?.sells;
    const mcap = pairObj?.marketCap ?? pairObj?.fdv;

    setText('mPrice', fmtPriceUsd(priceUsd));
    setText('mLiq', fmtCompactUsd(liqUsd));
    setText('mVol', fmtCompactUsd(vol24));
    setText('mMcap', fmtCompactUsd(mcap));
    if (Number.isFinite(Number(buys)) || Number.isFinite(Number(sells))) {
      setText('pulseBS', `${Number(buys) || 0} / ${Number(sells) || 0}`);
    }

    // age fields vary depending on DexScreener response
    const ageRaw = pairObj?.pairCreatedAt ?? pairObj?.createdAt ?? pairObj?.createdAtMs ?? pairObj?.createdAtTimestamp;
    setText('pulseAge', fmtAge(ageRaw));

    // Cosmetic status: show "Indexing / Low Activity" while data is missing or near-zero.
    const b = Number(buys) || 0;
    const s = Number(sells) || 0;
    const v = Number(vol24) || 0;
    const l = Number(liqUsd) || 0;
    const p = Number(priceUsd) || 0;
    const low = (!p || !Number.isFinite(p)) || ((b + s) === 0 && v === 0) || (l === 0);
    setPulseStatus(low ? 'Indexing / Low Activity' : '');
  } catch {}
}

async function bootPulse() {
  try {
    if (typeof document === 'undefined') return;

    // Only run if the Pulse panel exists
    const hasPulse = document.getElementById('mPrice') || document.getElementById('mLiq') || document.getElementById('mVol');
    if (!hasPulse) return;

    // Prefer official registry (single source of truth)
    const reg = await getRegistry(STATE.baseUrl).catch(() => null);

    const runtime = (typeof window !== 'undefined' && window.CAPI_CONFIG) ? window.CAPI_CONFIG : {};
    const dsCfg = runtime?.DEXSCREENER || {};

    const apiBase = dsCfg.apiBase || reg?.dex?.dexscreener?.apiBase || 'https://api.dexscreener.com/latest/dex/pairs';
    const chain = dsCfg.chain || reg?.dex?.dexscreener?.chain || 'ethereum';
    const pair = dsCfg.pair || pickPairFromRegistry(reg) || runtime?.DEX_PAIR_ADDRESS || '';
    const pollMs = Math.max(15000, Number(dsCfg.pollMs) || 30000);
    const timeoutMs = Math.max(1500, Number(dsCfg.timeoutMs) || 6500);

    // Wire the Live Market button to the official URL
    const marketUrl = reg?.links?.market || `https://dexscreener.com/${chain}/${pair}`;
    setHref('openDexScreener', marketUrl);

    if (!pair) return;

    // First run immediately, then poll
    const tick = async () => {
      try {
        // Default cosmetic state until we successfully parse live numbers.
        setPulseStatus('Indexing / Low Activity');
        const p = await fetchDexScreenerPair({ apiBase, chain, pair, timeoutMs });
        updatePulseFromPair(p);
      } catch {
        // keep placeholders (TBA/—)
        setPulseStatus('Indexing / Low Activity');
      }
    };

    await tick();
    setInterval(tick, pollMs);
  } catch {
    // never throw
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPulse, { once: true });
  } else {
    bootPulse();
  }
}