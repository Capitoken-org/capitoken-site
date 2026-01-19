// Capitoken runtime config (public)
// Loaded as classic <script> before trust-engine / market-engine.
//
// IMPORTANT:
// 1) Replace RPC_HTTP with your Alchemy (or other) HTTPS endpoint.
// 2) Commit & deploy.

(function () {
  window.CAPI_CONFIG = window.CAPI_CONFIG || {
    CHAIN_ID_HEX: '0x1',

    // Your Ethereum Mainnet RPC (Alchemy recommended)
    RPC_HTTP: 'https://eth-mainnet.g.alchemy.com/v2/QCaK5sYswRrOUNUTruubE',

    // Capitoken mainnet token contract
    CONTRACT_ADDRESS: '0xF2dA6C9B945c688A52D3B72340E622014920de6a',

    // Optional: Uniswap V2 pair address (leave null to auto-discover)
    DEX_PAIR_ADDRESS: '0xb96808b1270a89ea8a237d52df389619f347aea2',
  };

  // Back-compat for older code paths
  window.CAPI_RPC_HTTP = window.CAPI_RPC_HTTP || window.CAPI_CONFIG.RPC_HTTP;
})();
