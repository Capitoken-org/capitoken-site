// Capitoken runtime config (public)
// NOTE: This file MUST live at /public/capi-config.js so GitHub Pages serves it at /capi-config.js
// Version: PHASE94R20_ALCHEMY_STABLE

(function () {
  // You can override in console for testing:
  //   window.CAPI_RPC_HTTP = 'https://...'; location.reload();

  window.CAPI_CONFIG = window.CAPI_CONFIG || {};

  // Core network
  window.CAPI_CONFIG.chainIdHex = window.CAPI_CONFIG.chainIdHex || '0x1';
  window.CAPI_CONFIG.rpcHttp = window.CAPI_CONFIG.rpcHttp || 'https://eth-mainnet.g.alchemy.com/v2/QCaK5sYswRrOUNUTruubE';

  // Token + DEX (Uniswap V2)
  window.CAPI_CONFIG.token = window.CAPI_CONFIG.token || {};
  window.CAPI_CONFIG.token.address = window.CAPI_CONFIG.token.address || '0xF2dA6C9B945c688A52D3B72340E622014920de6a';

  window.CAPI_CONFIG.dex = window.CAPI_CONFIG.dex || {};
  // Optional: set this if you already know the Uniswap V2 pair address.
  // If null/empty, market-engine will resolve it on-chain via factory.getPair().
  window.CAPI_CONFIG.dex.pairAddress = window.CAPI_CONFIG.dex.pairAddress || null;

  // Back-compat aliases used by older code paths
  window.CAPI_RPC_HTTP = window.CAPI_RPC_HTTP || window.CAPI_CONFIG.rpcHttp;
  window.CAPI_CONFIG.RPC_HTTP = window.CAPI_CONFIG.RPC_HTTP || window.CAPI_CONFIG.rpcHttp;

  window.CAPI_CONFIG.CONTRACT_ADDRESS = window.CAPI_CONFIG.CONTRACT_ADDRESS || window.CAPI_CONFIG.token.address;
  window.CAPI_CONFIG.DEX_PAIR_ADDRESS = window.CAPI_CONFIG.DEX_PAIR_ADDRESS || window.CAPI_CONFIG.dex.pairAddress;

  // For super-legacy scripts
  window.CAPI_RPC_HTTP = window.CAPI_RPC_HTTP || window.CAPI_CONFIG.RPC_HTTP;
})();
