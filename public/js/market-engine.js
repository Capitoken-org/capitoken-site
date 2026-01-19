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
