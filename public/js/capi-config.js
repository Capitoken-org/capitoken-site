// Capitoken runtime config (public)
// Load this in the browser BEFORE trust-engine/market-engine.
// You only need to edit RPC_HTTP.

(function () {
  const CFG = {
    // Ethereum mainnet
    CHAIN_ID_HEX: '0x1',

    // ✅ Put your Alchemy HTTP URL here (client-side key)
    RPC_HTTP: 'https://eth-mainnet.g.alchemy.com/v2/QCaK5sYswRrOUNUTruubE',

    // Verified token contract (mainnet)
    CONTRACT_ADDRESS: '0xF2dA6C9B945c688A52D3B72340E622014920de6a',

    // Uniswap V2 pair (CAPI/WETH)
    // This is NOT Etherscan; it is the PAIR address (the pool contract).
    DEX_PAIR_ADDRESS: '0xb96808b1270A89eA8A237d52df389619f347AeA2',

    // Optional sanity checks
    TOKEN_SYMBOL_EXPECTED: 'CAPI',
    TOKEN_DECIMALS_EXPECTED: 18,

    // Optional helper token addresses (mainnet)
    TOKENS: {
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
  };

  // Public config objects used by the engines
  window.CAPI_CONFIG = CFG;
  // Back-compat for older code paths
  window.CAPI_RPC_HTTP = window.CAPI_RPC_HTTP || CFG.RPC_HTTP;
})();
