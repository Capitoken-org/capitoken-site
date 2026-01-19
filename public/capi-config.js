// Capitoken runtime config (public)
// This file is loaded BEFORE trust-engine.js and market-engine.js.
//
// Paste your Alchemy HTTP endpoint here:
//   https://eth-mainnet.g.alchemy.com/v2/<YOUR_KEY>
//
// Note: this is public, client-side config.

window.CAPI_CONFIG = {
  CHAIN_ID_HEX: '0x1',

  // Preferred JSON-RPC HTTP endpoint (Alchemy)
  RPC_HTTP: 'https://eth-mainnet.g.alchemy.com/v2/QCaK5sYswRrOUNUTruubE',

  // Verified token contract (CAPI)
  CONTRACT_ADDRESS: '0xF2dA6C9B945c688A52D3B72340E622014920de6a',

  // Optional: Uniswap V2 pair (WETH/CAPI). Leave null if you don't know it yet.
  // If you paste it, swap activity + price estimation becomes more reliable.
  DEX_PAIR_ADDRESS: null,
};

// Back-compat for older code paths
window.CAPI_RPC_HTTP = window.CAPI_RPC_HTTP || window.CAPI_CONFIG.RPC_HTTP;
