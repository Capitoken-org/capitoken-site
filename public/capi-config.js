// Capitoken runtime config (public)
window.CAPI_CONFIG = {
  CHAIN_ID_HEX: "0x1", // Ethereum mainnet
  RPC_HTTP: "https://eth-mainnet.g.alchemy.com/v2/QCaK5sYswRrOUNUTruubE",

  // Verified contract (mainnet)
  CONTRACT_ADDRESS: "0xF2dA6C9B945c688A52D3B72340E622014920de6a",

  // Optional: Uniswap V2 pair (LP) address
  DEX_PAIR_ADDRESS: null,

  TOKENS: {
    ETH: "ETH",
    USDC: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F"
  }
};

// Back-compat for older code paths (some scripts read window.CAPI_RPC_HTTP)
window.CAPI_RPC_HTTP = window.CAPI_RPC_HTTP || window.CAPI_CONFIG.RPC_HTTP;
