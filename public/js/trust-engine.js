// trust-engine.js (PHASE94R26_ONCHAIN)
// Builds a live "Trust Snapshot" using ONLY:
// - Your configured RPC (Alchemy)
// - On-chain reads (Uniswap V2 pair + Chainlink ETH/USD)
// No Dexscreener required for core live data.

export const ENGINE_VERSION = (() => {
  try { return new URL(import.meta.url).searchParams.get('v') || 'PHASE94R26_ONCHAIN'; }
  catch { return 'PHASE94R26_ONCHAIN'; }
})();

export const CONFIG = {
  CHAIN_ID_HEX_EXPECTED: '0x1',
  UNISWAP_V2_FACTORY: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  CHAINLINK_ETH_USD_FEED: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  TOKEN_IMAGE_URL: 'https://www.capitoken.org/assets/capi-logo-256.png',
};

// ---- small utils ----
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const SWAP_TOPIC0 = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';

function isAddr(a) { return typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a); }
function hexToBigInt(h) { return (!h || h === '0x') ? 0n : BigInt(h); }
function pad64(hNo0x) { return hNo0x.padStart(64, '0'); }
function addrToTopic(a) { return pad64(a.replace(/^0x/, '').toLowerCase()); }
function dataToBigints(data) {
  const d = (data || '0x').replace(/^0x/, '');
  const out = [];
  for (let i = 0; i < d.length; i += 64) out.push(BigInt('0x' + d.slice(i, i + 64)));
  return out;
}
function toAddrFromWord(word64) { return '0x' + word64.slice(24); }

function selector(sig) {
  // precomputed 4-byte selectors for the few calls we need
  switch (sig) {
    case 'decimals()': return '0x313ce567';
    case 'symbol()': return '0x95d89b41';
    case 'name()': return '0x06fdde03';
    case 'totalSupply()': return '0x18160ddd';
    case 'token0()': return '0x0dfe1681';
    case 'token1()': return '0xd21220a7';
    case 'getReserves()': return '0x0902f1ac';
    case 'getPair(address,address)': return '0xe6a43905';
    case 'latestRoundData()': return '0xfeaf968c';
    default: return null;
  }
}

function encodeCall(sel, args = []) {
  let hex = sel.replace(/^0x/, '');
  for (const a of args) hex += addrToTopic(a);
  return '0x' + hex;
}

async function rpc(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const json = await res.json().catch(() => ({}));
  if (json && json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

function getRuntime() {
  const cfg = (typeof window !== 'undefined' && window.CAPI_CONFIG) ? window.CAPI_CONFIG : {};
  const contract = (cfg.CONTRACT_ADDRESS || '').toString();
  const rpcUrl = (cfg.RPC_HTTP || window.CAPI_RPC_HTTP || '').toString();
  return { cfg, contract, rpcUrl };
}

async function ethCall(rpcUrl, to, data) {
  return rpc(rpcUrl, 'eth_call', [{ to, data }, 'latest']);
}

async function readUint(rpcUrl, to, sel) {
  const out = await ethCall(rpcUrl, to, sel);
  return hexToBigInt(out);
}

async function readAddr(rpcUrl, to, sel) {
  const out = await ethCall(rpcUrl, to, sel);
  const w = (out || '0x').replace(/^0x/, '').padStart(64, '0');
  return toAddrFromWord(w);
}

async function readString(rpcUrl, to, sel) {
  const out = await ethCall(rpcUrl, to, sel);
  const hex = (out || '0x').replace(/^0x/, '');
  if (!hex) return '';
  // Try "string" decoding for ABI-encoded dynamic string
  const offset = Number(BigInt('0x' + hex.slice(0, 64)));
  if (Number.isFinite(offset) && offset + 64 <= hex.length) {
    const len = Number(BigInt('0x' + hex.slice(offset * 2, offset * 2 + 64)));
    const start = offset * 2 + 64;
    const bytes = hex.slice(start, start + len * 2);
    let s = '';
    for (let i = 0; i < bytes.length; i += 2) s += String.fromCharCode(parseInt(bytes.slice(i, i + 2), 16));
    return s.replace(/\u0000/g, '');
  }
  return '';
}

async function resolvePair(rpcUrl, tokenAddr) {
  const factory = CONFIG.UNISWAP_V2_FACTORY;
  const weth = CONFIG.WETH;
  const data = encodeCall(selector('getPair(address,address)'), [tokenAddr, weth]);
  const out = await ethCall(rpcUrl, factory, data);
  const w = (out || '0x').replace(/^0x/, '').padStart(64, '0');
  const pair = toAddrFromWord(w);
  return pair;
}

async function readReserves(rpcUrl, pairAddr) {
  const out = await ethCall(rpcUrl, pairAddr, selector('getReserves()'));
  const hex = (out || '0x').replace(/^0x/, '').padStart(64 * 3, '0');
  const r0 = BigInt('0x' + hex.slice(0, 64));
  const r1 = BigInt('0x' + hex.slice(64, 128));
  return { r0, r1 };
}

async function readEthUsd(rpcUrl) {
  // Chainlink AggregatorV3Interface.latestRoundData() returns: (uint80,int256,uint256,uint256,uint80)
  const out = await ethCall(rpcUrl, CONFIG.CHAINLINK_ETH_USD_FEED, selector('latestRoundData()'));
  const words = (out || '0x').replace(/^0x/, '').padStart(64 * 5, '0');
  const priceInt = BigInt('0x' + words.slice(64, 128));
  // Chainlink ETH/USD feed uses 8 decimals
  return Number(priceInt) / 1e8;
}

function fmtNum(x, digits = 4) {
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function nowMs() { return Date.now(); }

// ---- PUBLIC API used by index.astro ----
export function setRuntimeConfig(runtimeCfg) {
  // Optional hook; index.astro calls ensureRuntimeConfig separately.
  // We keep it for back-compat.
  try {
    if (typeof window !== 'undefined' && runtimeCfg && typeof runtimeCfg === 'object') {
      window.CAPI_CONFIG = Object.assign({}, window.CAPI_CONFIG || {}, runtimeCfg);
    }
  } catch {}
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error('No wallet found');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  return (accounts && accounts[0]) ? accounts[0] : null;
}

export async function switchToMainnet() {
  if (!window.ethereum) throw new Error('No wallet found');
  await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
}

export async function addTokenToWallet() {
  const { contract } = getRuntime();
  if (!window.ethereum || !isAddr(contract)) throw new Error('Missing token address');
  const symbol = 'CAPI';
  const decimals = 18;
  await window.ethereum.request({
    method: 'wallet_watchAsset',
    params: {
      type: 'ERC20',
      options: {
        address: contract,
        symbol,
        decimals,
        image: CONFIG.TOKEN_IMAGE_URL,
      },
    },
  });
}

export async function getSnapshot() {
  const { contract, rpcUrl } = getRuntime();
  const ts = nowMs();

  const base = {
    ts,
    chain: 'Ethereum Mainnet',
    token: { address: contract, symbol: 'CAPI', name: 'Capitoken', decimals: 18 },
    contract: { address: contract, hasCode: false },
    pair: { address: null, token0: null, token1: null, reserveWeth: 0, reserveToken: 0 },
    market: {
      priceUsd: null,
      priceWeth: null,
      liquidityWeth: null,
      liquidityUsd: null,
      fdvUsd: null,
      volume24hUsd: null,
    },
    health: {
      score: 60,
      label: 'EARLY',
      slippage1k: null,
      buySellRatio: null,
      lpLock: 'UNKNOWN',
      lpProvider: '—',
      flags: ['LOW LIQUIDITY', 'LOW VOLUME'],
    },
    notes: [],
  };

  if (!rpcUrl || !rpcUrl.startsWith('http')) {
    base.notes.push('RPC not set');
    return base;
  }
  if (!isAddr(contract)) {
    base.notes.push('Invalid token address');
    return base;
  }

  // Contract code
  try {
    const code = await rpc(rpcUrl, 'eth_getCode', [contract, 'latest']);
    base.contract.hasCode = !!code && code !== '0x';
  } catch (e) {
    base.notes.push('RPC eth_getCode failed');
  }

  // Resolve pair
  let pairAddr = null;
  try {
    pairAddr = await resolvePair(rpcUrl, contract);
    if (!isAddr(pairAddr) || pairAddr.toLowerCase() === ZERO_ADDR) pairAddr = null;
  } catch (e) {
    base.notes.push('Pair resolve failed');
  }
  base.pair.address = pairAddr;

  // Token meta + supply (best effort)
  try {
    const [sym, nm, dec, supply] = await Promise.all([
      readString(rpcUrl, contract, selector('symbol()')),
      readString(rpcUrl, contract, selector('name()')),
      readUint(rpcUrl, contract, selector('decimals()')),
      readUint(rpcUrl, contract, selector('totalSupply()')),
    ]);
    if (sym) base.token.symbol = sym;
    if (nm) base.token.name = nm;
    if (dec > 0n && dec < 255n) base.token.decimals = Number(dec);
    base.token.totalSupply = supply;
  } catch {
    // ignore
  }

  // Pair reserves + prices
  try {
    if (pairAddr) {
      const [t0, t1, reserves, ethUsd] = await Promise.all([
        readAddr(rpcUrl, pairAddr, selector('token0()')),
        readAddr(rpcUrl, pairAddr, selector('token1()')),
        readReserves(rpcUrl, pairAddr),
        readEthUsd(rpcUrl),
      ]);
      base.pair.token0 = t0;
      base.pair.token1 = t1;

      const r0 = reserves.r0;
      const r1 = reserves.r1;

      const weth = CONFIG.WETH.toLowerCase();
      const is0Weth = t0 && t0.toLowerCase() === weth;
      const is1Weth = t1 && t1.toLowerCase() === weth;

      // Convert to human numbers
      const wethReserve = is0Weth ? Number(r0) / 1e18 : (is1Weth ? Number(r1) / 1e18 : 0);
      const tokenReserveRaw = is0Weth ? r1 : r0;
      const tokenReserve = Number(tokenReserveRaw) / Math.pow(10, base.token.decimals || 18);

      base.pair.reserveWeth = wethReserve;
      base.pair.reserveToken = tokenReserve;

      if (wethReserve > 0 && tokenReserve > 0 && (is0Weth || is1Weth)) {
        const priceWeth = wethReserve / tokenReserve;
        const priceUsd = priceWeth * ethUsd;
        base.market.priceWeth = priceWeth;
        base.market.priceUsd = priceUsd;
        base.market.liquidityWeth = wethReserve * 2;
        base.market.liquidityUsd = wethReserve * 2 * ethUsd;

        // FDV
        if (base.token.totalSupply) {
          const supply = Number(base.token.totalSupply) / Math.pow(10, base.token.decimals || 18);
          base.market.fdvUsd = supply * priceUsd;
        }

        // Slippage approx for a $1000 buy (very rough): trade / (liqUSD/2)
        const depthUsd = (base.market.liquidityUsd || 0) / 2;
        if (depthUsd > 0) base.health.slippage1k = (1000 / depthUsd) * 100;

        // Adjust health flags
        base.health.flags = [];
        if ((base.market.liquidityUsd || 0) < 5000) base.health.flags.push('LOW LIQUIDITY');
        base.health.flags.push('EARLY LAUNCH');
      }

      // cache registry for market-engine
      try {
        window.__CAPI_REGISTRY = {
          chainIdHex: '0x1',
          tokenAddress: contract,
          pairAddress: pairAddr,
          wethAddress: CONFIG.WETH,
        };
      } catch {}
    }
  } catch (e) {
    base.notes.push('Pair reads failed');
  }

  // Make strings for UI helpers (index.astro can also render raw)
  base.ui = {
    priceUsd: fmtNum(base.market.priceUsd, 8),
    mcapUsd: base.market.fdvUsd ? fmtNum(base.market.fdvUsd, 0) : '—',
    liqWeth: base.market.liquidityWeth ? fmtNum(base.market.liquidityWeth, 4) : '—',
    vol24hUsd: base.market.volume24hUsd ? fmtNum(base.market.volume24hUsd, 0) : '—',
  };

  return base;
}

