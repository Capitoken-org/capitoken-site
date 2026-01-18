/* trust-engine.js (PHASE94R14_STABLE) */
// src/js/trust-engine.js
// Phase 9.3 Market Live Final: snapshot real (on-chain + DexScreener) driven by official-registry.json

// Cache-buster version (keeps GitHub Pages and aggressive browsers from serving stale JS)
// IMPORTANT: trust-engine and market-engine must always use the SAME revision.
// We derive it from THIS module URL (?v=...). This prevents mixed loads like:
//   trust-engine.js?v=PHASE94R8 + market-engine.js?v=PHASE94R3
// IMPORTANT: keep revision tags consistent across assets.
// index.astro loads this file as: /js/trust-engine.js?v=PHASE94R12
// If we hardcode a different revision here, this module will import a mismatched
// market-engine revision (because we append ?v=${ENGINE_VERSION}), causing
// intermittent / mixed behavior (seen as R3/R7/etc. in Network).
export const ENGINE_VERSION = (() => {
  try {
    return new URL(import.meta.url).searchParams.get('v') || "PHASE94R12";
  } catch {
    return "PHASE94R12";
  }
})();

export const CONFIG = {
  // Defaults (will be overwritten by registry at runtime)
  CAPITOKEN_ADDRESS: "0x0000000000000000000000000000000000000000",
  CAPITOKEN_SYMBOL_EXPECTED: "CAPI",
  CAPITOKEN_DECIMALS_EXPECTED: 18,

  UNISWAP_PAIR_EXPECTED: "0x0000000000000000000000000000000000000000",

  // Uniswap V2 mainnet
  UNISWAP_V2_FACTORY: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  WETH_ADDRESS: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",

  // Token image used by wallet_watchAsset (must be HTTPS public)
  TOKEN_IMAGE_URL: "https://www.capitoken.org/assets/capi-logo-256.png",

  // Fallback RPC read-only
  RPC_HTTP: "https://cloudflare-eth.com",

  // Liquidity threshold
  MIN_LIQ_WEI: 25n * (10n ** 16n), // 0.25 ETH
};

const CHAIN_ID_MAINNET = "0x1";

function shortAddr(a) {
  return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "";
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function withTimeout(promise, ms, label = "TIMEOUT") {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

async function ethRequest(method, params = []) {
  if (!window.ethereum) throw new Error("NO_METAMASK");
  return await window.ethereum.request({ method, params });
}

async function rpcCall(rpcUrl, method, params = []) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC_ERROR");
  return json.result;
}

async function readContractCall(to, data, useMetamask = true) {
  const params = [{ to, data }, "latest"];
  if (useMetamask && window.ethereum) return await ethRequest("eth_call", params);
  return await rpcCall(CONFIG.RPC_HTTP, "eth_call", params);
}

// Precomputed selectors (no ABI dependency)
const SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
  owner: "0x8da5cb5b",
};

function decodeString(hex) {
  if (!hex || hex === "0x") return "";
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (data.length < 128) return "";
  const lenHex = data.slice(64, 128);
  const len = Number.parseInt(lenHex, 16);
  const strHex = data.slice(128, 128 + len * 2);
  let out = "";
  for (let i = 0; i < strHex.length; i += 2) out += String.fromCharCode(parseInt(strHex.slice(i, i + 2), 16));
  return out.replace(/\u0000/g, "");
}

function decodeUint(hex) {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function decodeAddress(hex) {
  if (!hex || hex === "0x") return "";
  const clean = hex.slice(2).padStart(64, "0");
  return "0x" + clean.slice(24);
}

/**
 * Loads official-registry.json from the current site origin.
 * This keeps the launch wiring in one place.
 */
async function loadRegistry() {
  const url = new URL("official-registry.json", window.location.href).toString();
  const res = await withTimeout(fetch(url, { cache: "no-store" }), 5000, "REGISTRY_TIMEOUT");
  if (!res.ok) throw new Error(`REGISTRY_HTTP_${res.status}`);
  return await res.json();
}

function applyRegistryToConfig(reg) {
  const contractAddr = reg?.contract?.address;
  const pairAddr = reg?.pair?.address;

  if (contractAddr) CONFIG.CAPITOKEN_ADDRESS = contractAddr;
  if (pairAddr) CONFIG.UNISWAP_PAIR_EXPECTED = pairAddr;

  const sym = reg?.contract?.token?.symbol;
  const dec = reg?.contract?.token?.decimals;

  if (sym) CONFIG.CAPITOKEN_SYMBOL_EXPECTED = sym;
  if (Number.isFinite(dec)) CONFIG.CAPITOKEN_DECIMALS_EXPECTED = Number(dec);

  // Optional: if you ever add a registry field for token image
  const img = reg?.links?.tokenImage;
  if (img && typeof img === "string" && img.startsWith("https://")) CONFIG.TOKEN_IMAGE_URL = img;

  // DexScreener URL from registry pair
  const chain = reg?.pair?.chain || "ethereum";
  const p = CONFIG.UNISWAP_PAIR_EXPECTED;
  CONFIG.DEXSCREENER_PAIR_URL = `https://api.dexscreener.com/latest/dex/pairs/${chain}/${p}`;
}

async function fetchDexScreenerPair() {
  const url = `${CONFIG.DEXSCREENER_PAIR_URL}${CONFIG.DEXSCREENER_PAIR_URL.includes("?") ? "&" : "?"}t=${Date.now()}`;
  const res = await withTimeout(fetch(url, { cache: "no-store" }), 8000, "DEX_TIMEOUT");
  if (!res.ok) throw new Error(`DEX_HTTP_${res.status}`);
  const json = await res.json();
  const p = json?.pairs?.[0];
  if (!p) return null;

  return {
    priceUsd: p.priceUsd ?? null,
    fdv: p.fdv ?? null,
    liquidityUsd: p.liquidity?.usd ?? null,
    volumeH24: p.volume?.h24 ?? null,
    priceChangeH24: p.priceChange?.h24 ?? null,
    dexId: p.dexId ?? null,
    pairAddress: p.pairAddress ?? null,
    baseSymbol: p.baseToken?.symbol ?? null,
    quoteSymbol: p.quoteToken?.symbol ?? null,
  };
}

// -------------------------------
// Phase 9.4: Market Health (uses market-engine.js best-effort)
// -------------------------------
async function fetchMarketHealth() {
  // Import relative to THIS module to avoid base-path and revision mismatches.
  // trust-engine.js lives in /js, so this resolves to /js/market-engine.js.
  const marketUrl = new URL(`market-engine.js?v=${encodeURIComponent(ENGINE_VERSION)}`, import.meta.url).toString();

  // Base URL for other fetches (eg, /official-registry.json)
  const base = new URL('.', window.location.href);

  const mod = await import(marketUrl);
  // market-engine expects a baseUrl that can resolve official-registry.json correctly
  mod.setMarketConfig({ baseUrl: base.toString() });

  // Returns normalized snapshot with healthBoost + flags
  return await mod.getMarketSnapshot();
}

function mergeUnique(arr, items) {
  for (const it of items) if (!arr.includes(it)) arr.push(it);
}

export async function getTrustState() {
  // Load registry first (fails "soft": we still return state with alerts)
  let reg = null;
  try {
    reg = await loadRegistry();
    applyRegistryToConfig(reg);
  } catch {
    // registry failure shouldn't brick trust panel
  }

  const state = {
    registry: reg,

    // wallet/network
    metamask: false,
    chainId: null,
    chainOk: false,
    account: null,
    accountShort: null,

    // token
    contractExists: false,
    tokenName: null,
    tokenSymbol: null,
    tokenDecimals: null,
    totalSupply: null,
    owner: null,

    // dex/liquidity
    uniswapPairOnChain: null,
    uniswapPairExpected: CONFIG.UNISWAP_PAIR_EXPECTED,
    pairMatchesExpected: null,
    liquidityEthWei: null,

    // market snapshot (DexScreener)
    marketStatus: "TBA",
    priceUsd: null,
    fdv: null,
    liquidityUsd: null,
    volumeH24: null,
    priceChangeH24: null,
    dexId: null,

    // market health (Phase 9.4)
    marketHealthScore: null,
    marketHealthLabel: null,
    marketHealthBoost: 0,
    marketHealthFlags: [],
    slippage1kPct: null,
    buySellRatio24h: null,
    lpLocked: null,
    lpLockProvider: null,

    // scoring
    trustScore: 0,
    trustLabel: "HIGH RISK",
    alerts: [],
  };

  // Detect MetaMask
  state.metamask = !!window.ethereum;

  if (state.metamask) {
    try {
      state.chainId = await ethRequest("eth_chainId");
      state.chainOk = state.chainId === CHAIN_ID_MAINNET;
      const accounts = await ethRequest("eth_accounts");
      state.account = accounts?.[0] || null;
      state.accountShort = state.account ? shortAddr(state.account) : null;
      if (!state.chainOk) state.alerts.push("WRONG_NETWORK");
    } catch {
      state.alerts.push("METAMASK_ERROR");
    }
  } else {
    state.alerts.push("NO_METAMASK");
  }

  // Contract exists
  try {
    const code = state.metamask
      ? await ethRequest("eth_getCode", [CONFIG.CAPITOKEN_ADDRESS, "latest"])
      : await rpcCall(CONFIG.RPC_HTTP, "eth_getCode", [CONFIG.CAPITOKEN_ADDRESS, "latest"]);
    state.contractExists = !!code && code !== "0x";
    if (!state.contractExists) state.alerts.push("CONTRACT_NOT_FOUND");
  } catch {
    state.alerts.push("CONTRACT_CHECK_FAILED");
  }

  // Token reads
  if (state.contractExists) {
    try {
      const useMM = !!window.ethereum && state.chainOk;
      const nameHex = await readContractCall(CONFIG.CAPITOKEN_ADDRESS, SELECTORS.name, useMM);
      const symbolHex = await readContractCall(CONFIG.CAPITOKEN_ADDRESS, SELECTORS.symbol, useMM);
      const decimalsHex = await readContractCall(CONFIG.CAPITOKEN_ADDRESS, SELECTORS.decimals, useMM);
      const tsHex = await readContractCall(CONFIG.CAPITOKEN_ADDRESS, SELECTORS.totalSupply, useMM);

      state.tokenName = decodeString(nameHex);
      state.tokenSymbol = decodeString(symbolHex);
      state.tokenDecimals = Number(decodeUint(decimalsHex));
      state.totalSupply = decodeUint(tsHex);

      try {
        const ownerHex = await readContractCall(CONFIG.CAPITOKEN_ADDRESS, SELECTORS.owner, useMM);
        state.owner = decodeAddress(ownerHex);
      } catch {
        state.owner = null;
        state.alerts.push("OWNER_UNAVAILABLE");
      }

      if (state.tokenSymbol !== CONFIG.CAPITOKEN_SYMBOL_EXPECTED) state.alerts.push("SYMBOL_MISMATCH");
      if (state.tokenDecimals !== CONFIG.CAPITOKEN_DECIMALS_EXPECTED) state.alerts.push("DECIMALS_MISMATCH");
    } catch {
      state.alerts.push("TOKEN_READ_FAILED");
    }
  }

  // Uniswap getPair(token, WETH)
  const GET_PAIR_SELECTOR = "0xe6a43905";
  const pad32 = (addr) => addr.toLowerCase().replace("0x", "").padStart(64, "0");

  try {
    const data = GET_PAIR_SELECTOR + pad32(CONFIG.CAPITOKEN_ADDRESS) + pad32(CONFIG.WETH_ADDRESS);
    const useMM = !!window.ethereum && state.chainOk;
    const pairHex = await readContractCall(CONFIG.UNISWAP_V2_FACTORY, data, useMM);
    const pair = decodeAddress(pairHex);

    if (pair && pair !== "0x0000000000000000000000000000000000000000") {
      state.uniswapPairOnChain = pair;
      state.pairMatchesExpected = pair.toLowerCase() === CONFIG.UNISWAP_PAIR_EXPECTED.toLowerCase();
      if (!state.pairMatchesExpected) state.alerts.push("PAIR_MISMATCH_EXPECTED");
    } else {
      state.alerts.push("UNISWAP_PAIR_NOT_FOUND");
    }
  } catch {
    state.alerts.push("UNISWAP_PAIR_CHECK_FAILED");
  }

  // Read reserves
  const GET_RESERVES = "0x0902f1ac";
  const TOKEN0 = "0x0dfe1681";
  const TOKEN1 = "0xd21220a7";

  if (state.uniswapPairOnChain) {
    try {
      const useMM = !!window.ethereum && state.chainOk;

      const t0Hex = await readContractCall(state.uniswapPairOnChain, TOKEN0, useMM);
      const t1Hex = await readContractCall(state.uniswapPairOnChain, TOKEN1, useMM);
      const token0 = decodeAddress(t0Hex);
      const token1 = decodeAddress(t1Hex);

      const reservesHex = await readContractCall(state.uniswapPairOnChain, GET_RESERVES, useMM);
      const d = reservesHex.startsWith("0x") ? reservesHex.slice(2) : reservesHex;
      const r0 = BigInt("0x" + d.slice(0, 64));
      const r1 = BigInt("0x" + d.slice(64, 128));

      let wethReserve;
      if (token0.toLowerCase() === CONFIG.WETH_ADDRESS.toLowerCase()) wethReserve = r0;
      else if (token1.toLowerCase() === CONFIG.WETH_ADDRESS.toLowerCase()) wethReserve = r1;

      if (wethReserve === undefined) {
        state.alerts.push("WETH_RESERVE_UNKNOWN");
      } else {
        state.liquidityEthWei = wethReserve;
        if (wethReserve < CONFIG.MIN_LIQ_WEI) state.alerts.push("LOW_LIQUIDITY");
      }
    } catch {
      state.alerts.push("RESERVES_READ_FAILED");
    }
  }

  // DexScreener market snapshot
  try {
    const m = await fetchDexScreenerPair();
    if (!m) {
      state.marketStatus = "NOT_INDEXED";
      state.alerts.push("MARKET_NOT_INDEXED");
    } else {
      state.marketStatus = "LIVE";
      state.priceUsd = m.priceUsd;
      state.fdv = m.fdv;
      state.liquidityUsd = m.liquidityUsd;
      state.volumeH24 = m.volumeH24;
      state.priceChangeH24 = m.priceChangeH24;
      state.dexId = m.dexId;

      if (m.pairAddress && m.pairAddress.toLowerCase() !== CONFIG.UNISWAP_PAIR_EXPECTED.toLowerCase()) {
        state.alerts.push("DEXSCREENER_PAIR_MISMATCH");
      }
    }
  } catch {
    state.marketStatus = "UNAVAILABLE";
    state.alerts.push("MARKET_API_ERROR");
  }


  // Market health (Phase 9.4) - best effort, never bricks panel
  let marketBoost = 0;
  try {
    const mh = await fetchMarketHealth();

    state.marketHealthScore = Number.isFinite(mh?.marketHealthScore) ? mh.marketHealthScore : null;
    state.marketHealthLabel = mh?.marketHealthLabel || null;
    marketBoost = Number.isFinite(mh?.healthBoost) ? mh.healthBoost : 0;
    state.marketHealthBoost = clamp(marketBoost, 0, 15);
    state.marketHealthFlags = Array.isArray(mh?.healthFlags) ? mh.healthFlags.slice(0, 12) : [];
    state.slippage1kPct = Number.isFinite(mh?.slippageEst?.buy1kPct) ? mh.slippageEst.buy1kPct : null;
    state.buySellRatio24h = Number.isFinite(mh?.buySellRatio) ? mh.buySellRatio : null;
    state.lpLocked = (mh?.lp?.locked === true) ? true : (mh?.lp?.locked === false ? false : null);
    state.lpLockProvider = (mh?.lp?.lockProvider ? String(mh.lp.lockProvider) : null);

    // Promote key market health flags to Trust alerts (keep concise)
    // NOTE: During EARLY LAUNCH we keep most of these informational (in the Market Health panel)
    // so the Trust Snapshot doesn't scream risk on day 1.
    const promoted = [];
    const early = (mh?.isEarlyLaunch === true);
    const slip = mh?.slippageEst?.buy1kPct;
    const liqUsd = mh?.liquidityUsd;
    const vol24 = mh?.volumeH24;

    // Always promote if LP explicitly unlocked
    if (mh?.lp?.locked === false) promoted.push("NO_LP_LOCK");

    // Promote slippage / liquidity only if not early OR if it's extreme
    const extremeEarly = early &&
      (Number.isFinite(liqUsd) && liqUsd < 200) &&
      (Number.isFinite(slip) && slip >= 30) &&
      (Number.isFinite(vol24) && vol24 < 10);

    if (!early || extremeEarly) {
      if (Number.isFinite(slip) && slip >= 5) promoted.push("HIGH_SLIPPAGE");
      if (state.marketHealthFlags.includes("LOW_LIQUIDITY")) promoted.push("LOW_LIQUIDITY");
      if (state.marketHealthFlags.includes("LOW_VOLUME")) promoted.push("LOW_VOLUME");
      if (state.marketHealthFlags.includes("SELL_PRESSURE")) promoted.push("SELL_PRESSURE");
      if (state.marketHealthFlags.includes("HIGH_HOLDER_CONCENTRATION")) promoted.push("HIGH_HOLDER_CONCENTRATION");
    }

    mergeUnique(state.alerts, promoted);
  } catch {
    mergeUnique(state.alerts, ["MARKET_DATA_UNAVAILABLE"]);
    state.marketHealthBoost = 0;
  }

  // Trust score
  let score = 0;

  if (state.contractExists) score += 30;
  if (state.totalSupply !== null && state.totalSupply > 0n) score += 10;

  // Domain check (prod allowlist from registry + safe dev hosts)
  // - In PROD: enforce registry.allowedDomains (exact or suffix match)
  // - In DEV (Codespaces / localhost): allow to avoid bricking previews
  try {
    const host = (location.hostname || "").toLowerCase();

    // DEV hosts we explicitly allow for previews
    const DEV_ALLOWED = [
      "localhost",
      "127.0.0.1",
      "github.dev",
      "app.github.dev"
    ];

    const isDevHost =
      DEV_ALLOWED.includes(host) ||
      host.endsWith(".github.dev") ||
      host.endsWith(".app.github.dev");

    const allowed = (state.registry?.allowedDomains || [])
      .map((h) => String(h).toLowerCase().trim())
      .filter(Boolean);

    const matchesAllowed = (h) => {
      // exact match
      if (allowed.includes(h)) return true;
      // suffix match support: allow entries like ".capitoken.org"
      return allowed.some((a) => a.startsWith(".") && h.endsWith(a));
    };

    if (isDevHost) {
      // Don't penalize preview environments
      score += 5;
    } else if (allowed.length === 0) {
      // If registry doesn't define allowedDomains, don't brick the site.
      // Still surface a warning so you remember to set it before going live.
      state.alerts.push("DOMAIN_ALLOWLIST_EMPTY");
    } else if (matchesAllowed(host)) {
      score += 5;
    } else {
      state.alerts.push("DOMAIN_NOT_ALLOWED");
    }
  } catch {}

  // Liquidity score (tiered so early launch isn't auto "HIGH RISK")
  if (state.liquidityEthWei !== null) {
    const liq = state.liquidityEthWei;
    const e18 = 10n ** 18n;
    if (liq >= 5n * e18) score += 25;
    else if (liq >= 1n * e18) score += 18;
    else if (liq >= 25n * (10n ** 16n)) score += 12; // 0.25 ETH
    else if (liq >= 10n * (10n ** 16n)) score += 8;  // 0.10 ETH
    else if (liq >= 5n * (10n ** 16n)) score += 5;   // 0.05 ETH
    // below 0.05 gives no liquidity points
  }

  if (state.uniswapPairOnChain) score += 10;

  // Market status (don't punish NOT_INDEXED during early launch)
  if (state.marketStatus === "LIVE") score += 10;
  else if (state.marketStatus === "NOT_INDEXED" && state.uniswapPairOnChain) score += 3;

  // Phase 9.4: Market health boost (0..15)
  if (state.marketHealthBoost) score += state.marketHealthBoost;

  score = clamp(score, 0, 100);
  state.trustScore = score;

  // Labeling: avoid "HIGH RISK" for normal early-launch conditions
  const earlyOnly = state.alerts.length > 0 && state.alerts.every((a) =>
    ["LOW_LIQUIDITY","MARKET_NOT_INDEXED","DOMAIN_ALLOWLIST_EMPTY"].includes(a)
  );

  if (score >= 90) state.trustLabel = "VERIFIED";
  else if (score >= 70) state.trustLabel = "TRUST BUILDING";
  else if (score >= 50 || earlyOnly) state.trustLabel = "EARLY LAUNCH";
  else if (score >= 35) state.trustLabel = "CAUTION";
  else state.trustLabel = "HIGH RISK";

  return state;
}

// Convenience: “snapshot” is the trust state itself
export async function getSnapshot() {
  return await getTrustState();
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error("NO_METAMASK");
  const accounts = await ethRequest("eth_requestAccounts");
  return accounts?.[0] || null;
}

export async function switchToMainnet() {
  if (!window.ethereum) throw new Error("NO_METAMASK");
  await ethRequest("wallet_switchEthereumChain", [{ chainId: CHAIN_ID_MAINNET }]);
}

export async function addTokenToWallet() {
  if (!window.ethereum) throw new Error("NO_METAMASK");
  return await ethRequest("wallet_watchAsset", [{
    type: "ERC20",
    options: {
      address: CONFIG.CAPITOKEN_ADDRESS,
      symbol: CONFIG.CAPITOKEN_SYMBOL_EXPECTED,
      decimals: CONFIG.CAPITOKEN_DECIMALS_EXPECTED,
      image: CONFIG.TOKEN_IMAGE_URL,
    },
  }]);
}
