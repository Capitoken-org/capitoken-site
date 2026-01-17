// src/js/trust-engine.js
import ERC20_ABI from "./abi/erc20.min.json";
import UNI_FACTORY_ABI from "./abi/uniswapV2Factory.min.json";
import UNI_PAIR_ABI from "./abi/uniswapV2Pair.min.json";

// ====== CONFIG (REEMPLAZA) ======
export const CONFIG = {
  CAPITOKEN_ADDRESS: "0xYOUR_CAPITOKEN_MAINNET_ADDRESS",
  CAPITOKEN_SYMBOL_EXPECTED: "CAPI",
  CAPITOKEN_DECIMALS_EXPECTED: 18,

  // Uniswap V2 mainnet
  UNISWAP_V2_FACTORY: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  WETH_ADDRESS: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",

  // Token image for wallet_watchAsset (debe ser https)
  TOKEN_IMAGE_URL: "https://TU_DOMINIO/assets/capi-logo-256.png",

  // Fallback RPC read-only (si no hay MetaMask o para validaciones paralelas)
  RPC_HTTP: "https://cloudflare-eth.com",

  // Liquidity threshold (ejemplo)
  MIN_LIQ_ETH: 5n, // 5 ETH
};

// ====== HELPERS ======
const CHAIN_ID_MAINNET = "0x1";

function shortAddr(a) {
  return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "";
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function ethRequest(method, params = []) {
  if (!window.ethereum) throw new Error("NO_METAMASK");
  return await window.ethereum.request({ method, params });
}

// Minimal JSON-RPC for fallback
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

// Encode function calls without ethers/web3: we’ll use MetaMask for contract calls when available.
// If you want 100% independence, migramos a ethers.js (recomendado). Por ahora: simple + robusto.
async function readContractCall(to, data, useMetamask = true) {
  const params = [{ to, data }, "latest"];
  if (useMetamask && window.ethereum) {
    return await ethRequest("eth_call", params);
  }
  return await rpcCall(CONFIG.RPC_HTTP, "eth_call", params);
}

// Very small ABI encoder for common ERC20 calls (name/symbol/decimals/totalSupply/owner)
// (function selectors precomputed)
const SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
  owner: "0x8da5cb5b",
};

function hexToBigInt(hex) {
  return BigInt(hex);
}

// Decode string returned by ERC20 name/symbol (ABI encoded)
function decodeString(hex) {
  // hex: 0x + offset(32) + len(32) + data...
  // This minimal decode assumes standard ABI encoding.
  if (!hex || hex === "0x") return "";
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (data.length < 128) return "";
  const lenHex = data.slice(64, 128);
  const len = Number.parseInt(lenHex, 16);
  const strHex = data.slice(128, 128 + len * 2);
  let out = "";
  for (let i = 0; i < strHex.length; i += 2) {
    out += String.fromCharCode(parseInt(strHex.slice(i, i + 2), 16));
  }
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

// ====== ENGINE ======
export async function getTrustState() {
  const state = {
    metamask: false,
    chainId: null,
    chainOk: false,
    account: null,
    accountShort: null,

    contractExists: false,
    tokenName: null,
    tokenSymbol: null,
    tokenDecimals: null,
    totalSupply: null,
    owner: null,

    uniswapPair: null,
    liquidityEth: null,

    trustScore: 0,
    trustLabel: "HIGH RISK",
    alerts: [],
  };

  // 7.1 Detect MetaMask
  state.metamask = !!window.ethereum;

  // Get chain/account if available
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

  // 7.3 Contract exists
  try {
    const code = state.metamask
      ? await ethRequest("eth_getCode", [CONFIG.CAPITOKEN_ADDRESS, "latest"])
      : await rpcCall(CONFIG.RPC_HTTP, "eth_getCode", [CONFIG.CAPITOKEN_ADDRESS, "latest"]);

    state.contractExists = !!code && code !== "0x";
    if (!state.contractExists) state.alerts.push("CONTRACT_NOT_FOUND");
  } catch {
    state.alerts.push("CONTRACT_CHECK_FAILED");
  }

  // Read token fields (best effort)
  if (state.contractExists) {
    try {
      const useMM = !!window.ethereum && state.chainOk; // prefer MM only if mainnet
      const nameHex = await readContractCall(CONFIG.CAPITOKEN_ADDRESS, SELECTORS.name, useMM);
      const symbolHex = await readContractCall(CONFIG.CAPITOKEN_ADDRESS, SELECTORS.symbol, useMM);
      const decimalsHex = await readContractCall(CONFIG.CAPITOKEN_ADDRESS, SELECTORS.decimals, useMM);
      const tsHex = await readContractCall(CONFIG.CAPITOKEN_ADDRESS, SELECTORS.totalSupply, useMM);

      state.tokenName = decodeString(nameHex);
      state.tokenSymbol = decodeString(symbolHex);
      state.tokenDecimals = Number(decodeUint(decimalsHex));
      state.totalSupply = decodeUint(tsHex);

      // owner() puede no existir; no romper si falla
      try {
        const ownerHex = await readContractCall(CONFIG.CAPITOKEN_ADDRESS, SELECTORS.owner, useMM);
        state.owner = decodeAddress(ownerHex);
      } catch {
        state.owner = null;
        state.alerts.push("OWNER_UNAVAILABLE");
      }

      // Validate expected
      if (state.tokenSymbol !== CONFIG.CAPITOKEN_SYMBOL_EXPECTED) state.alerts.push("SYMBOL_MISMATCH");
      if (state.tokenDecimals !== CONFIG.CAPITOKEN_DECIMALS_EXPECTED) state.alerts.push("DECIMALS_MISMATCH");
    } catch {
      state.alerts.push("TOKEN_READ_FAILED");
    }
  }

  // 7.4 Uniswap liquidity: getPair via factory (on-chain)
  // Implementacion: usamos RPC eth_call a getPair selector (manual) para mantener minimalismo.
  // Selector getPair(address,address) = 0xe6a43905
  const GET_PAIR_SELECTOR = "0xe6a43905";
  function pad32(addr) {
    return addr.toLowerCase().replace("0x", "").padStart(64, "0");
  }

  try {
    const data = GET_PAIR_SELECTOR + pad32(CONFIG.CAPITOKEN_ADDRESS) + pad32(CONFIG.WETH_ADDRESS);
    const useMM = !!window.ethereum && state.chainOk;
    const pairHex = await readContractCall(CONFIG.UNISWAP_V2_FACTORY, data, useMM);
    // return is address padded to 32 bytes
    const pair = decodeAddress(pairHex);
    if (pair && pair !== "0x0000000000000000000000000000000000000000") {
      state.uniswapPair = pair;
    } else {
      state.alerts.push("UNISWAP_PAIR_NOT_FOUND");
    }
  } catch {
    state.alerts.push("UNISWAP_PAIR_CHECK_FAILED");
  }

  // If pair exists, read reserves (getReserves selector = 0x0902f1ac)
  // We must figure which reserve is WETH (token0/token1).
  const GET_RESERVES = "0x0902f1ac";
  const TOKEN0 = "0x0dfe1681";
  const TOKEN1 = "0xd21220a7";

  if (state.uniswapPair) {
    try {
      const useMM = !!window.ethereum && state.chainOk;

      const t0Hex = await readContractCall(state.uniswapPair, TOKEN0, useMM);
      const t1Hex = await readContractCall(state.uniswapPair, TOKEN1, useMM);
      const token0 = decodeAddress(t0Hex);
      const token1 = decodeAddress(t1Hex);

      const reservesHex = await readContractCall(state.uniswapPair, GET_RESERVES, useMM);
      const data = reservesHex.startsWith("0x") ? reservesHex.slice(2) : reservesHex;
      // getReserves returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)
      const r0 = BigInt("0x" + data.slice(0, 64));
      const r1 = BigInt("0x" + data.slice(64, 128));

      let wethReserve;
      if (token0.toLowerCase() === CONFIG.WETH_ADDRESS.toLowerCase()) wethReserve = r0;
      else if (token1.toLowerCase() === CONFIG.WETH_ADDRESS.toLowerCase()) wethReserve = r1;

      if (wethReserve === undefined) {
        state.alerts.push("WETH_RESERVE_UNKNOWN");
      } else {
        // WETH has 18 decimals; reserve is in wei
        state.liquidityEth = wethReserve; // keep as wei BigInt
        if (wethReserve < CONFIG.MIN_LIQ_ETH * 10n ** 18n) state.alerts.push("LOW_LIQUIDITY");
      }
    } catch {
      state.alerts.push("RESERVES_READ_FAILED");
    }
  }

  // ====== 7.5 Trust Score ======
  // Contract Valid (30)
  let score = 0;

  if (state.contractExists) score += 30;

  // Supply integrity (10) -> we at least could read totalSupply
  if (state.totalSupply !== null && state.totalSupply > 0n) score += 10;

  // Website match (5) -> if running on your domain, simple check:
  try {
    const hostOk = location.hostname && !location.hostname.includes("github.io"); // ajusta si quieres permitir github.io
    if (hostOk) score += 5;
  } catch {}

  // Liquidity Locked (25) -> (placeholder en esta fase: usamos “liquidity present” como proxy)
  // Si luego agregas verificacion de lock contract, aqui se reemplaza.
  if (state.liquidityEth !== null && state.liquidityEth >= CONFIG.MIN_LIQ_ETH * 10n ** 18n) score += 25;

  // Trading activity + holders growth (15+15) -> se deja en “future hook”
  // Se implementa en Fase 8/9 via Etherscan API o indexer.
  // Por ahora: si pair existe, damos parte del score.
  if (state.uniswapPair) score += 10;

  score = clamp(score, 0, 100);
  state.trustScore = score;

  if (score >= 90) state.trustLabel = "VERIFIED";
  else if (score >= 70) state.trustLabel = "TRUST BUILDING";
  else state.trustLabel = "HIGH RISK";

  return state;
}

// ====== ACTIONS ======
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
