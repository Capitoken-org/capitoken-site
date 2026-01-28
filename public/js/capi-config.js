// STAGING_SOCIALS_UPDATED 2026-01-27 21:16 UTC
// Capitoken runtime config (public)
// Load this in the browser BEFORE trust-engine/market-engine.
// You only need to edit RPC_HTTP.

(function () {
  const CFG = {
    // Ethereum mainnet
    CHAIN_ID_HEX: '0x1',

    // ✅ Put your Alchemy HTTP URL here (client-side key)
    RPC_HTTP: 'https://eth-mainnet.g.alchemy.com/v2/alcht_3m8w8aRpitNPLBNJjgUCaLM91pUrB2',

    // Verified token contract (mainnet)
    CONTRACT_ADDRESS: '0xF2dA6C9B945c688A52D3B72340E622014920de6a',

    // Uniswap V2 pair (CAPI/WETH)
    // This is NOT Etherscan; it is the PAIR address (the pool contract).
    DEX_PAIR_ADDRESS: '0xb96808b1270A89eA8A237d52df389619f347AeA2',

    // DexScreener (live stats for "CAPI Pulse")
    DEXSCREENER: {
      apiBase: 'https://api.dexscreener.com/latest/dex/pairs',
      chain: 'ethereum',
      pair: '0xb96808b1270A89eA8A237d52df389619f347AeA2',
      pollMs: 30000,   // refresh interval (30s)
      timeoutMs: 6500, // network timeout for fetch
    },

    // Optional sanity checks
    TOKEN_SYMBOL_EXPECTED: 'CAPI',
    TOKEN_DECIMALS_EXPECTED: 18,

    // Ownership renounce countdown (fixed to GMT-4 moment)
    // 17-Apr-2026 19:17 GMT-4 == 2026-04-17T23:17:00Z
    renounce: {
      targetUtcIso: '2026-04-17T23:17:00Z',
      label: 'RENOUNCE IN:',
      labelDone: 'RENOUNCED ✅',
    },

    // Optional helper token addresses (mainnet)
    TOKENS: {
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
    // Official social links (leave empty string if not available yet)
    SOCIALS: {
  x: "https://x.com/Capitokenorg",
  telegram: "https://t.me/CapitokenOfficial",
  youtube: "https://www.youtube.com/channel/UCY5xCVzo-k6hGdR4xhUhTNQ",
  medium: "https://medium.com/@info_43649",
  reddit: "https://www.reddit.com/user/CapiToken/",
  tiktok: "https://www.tiktok.com/@capitoken.official",
  facebook: "https://www.facebook.com/Capitoken.official/",
  instagram: "https://www.instagram.com/capitoken.official/",
	  discord: "https://discord.gg/XVHVaVWPq5"
},
    // Official Updates (first-party feed)
    // Point this to a GitHub Gist RAW URL containing announcements JSON.
    // If empty or blocked, the site falls back to /public/data/announcements.json.
    ANNOUNCEMENTS_GIST_URL: "https://gist.githubusercontent.com/Capitoken-org/fb30847eaea89c2c1861ebcca5f21f77/raw/fd6ee70e93095e4b54e30c63d637189da3cc6b9b/announcements.json",

    // Telegram embed (optional): channel username + pinned post ID
    // Example post URL: https://t.me/CapitokenOfficial/1234
    TELEGRAM_CHANNEL: "CapitokenOfficial",
    TELEGRAM_PINNED_POST_ID: "13",

  };

  // Public config objects used by the engines
  window.CAPI_CONFIG = CFG;
  // Back-compat for older code paths
  window.CAPI_RPC_HTTP = window.CAPI_RPC_HTTP || CFG.RPC_HTTP;
})();