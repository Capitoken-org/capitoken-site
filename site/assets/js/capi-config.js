// /site/assets/js/capi-config.js
// Configuración general de red, contrato y pares DEX (Uniswap V2)

window.CAPI_CONFIG = {
  // Red preferida: "0x1" Mainnet, "0xaa36a7" Sepolia, etc.
  PREFERRED_CHAIN_HEX: "0x1",

  // RPC solo-lectura (opcional). Si no lo pones, usa provider conectado o fallback público.
  RPC_URL: "",

  // Dirección del contrato (cuando despliegues):
  CONTRACT_ADDRESS: "",

  // WalletConnect v2 (Project ID): https://cloud.walletconnect.com
  WALLETCONNECT_PROJECT_ID: "YOUR_WALLETCONNECT_PROJECT_ID",

  // ======= DEX / Uniswap =======
  // Dirección del token CAPI (para armar URLs de Uniswap). Déjalo vacío por ahora.
  TOKEN_ADDRESS: "", // "0x... CAPI"

  // Tokens comunes (Mainnet). Si estás en testnet, estos cambian.
  TOKENS: {
    ETH: "ETH",
    USDC: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI:  "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
  },

  // Pares Uniswap V2 (opcional para precio/liquidez rápida)
  // Coloca aquí las direcciones de los pares cuando existan.
  UNISWAP_V2_PAIRS: {
    CAPI_USDC: "", // ej: "0xPar_CAPI_USDC"
    CAPI_WETH: ""  // ej: "0xPar_CAPI_WETH"
  },

  // DEMO: true = usa datos ficticios para precio/liquidez si faltan pares
  DEMO: true
};

// Construye URL de swap en Uniswap
window.uniswapUrl = (input, output) =>
  `https://app.uniswap.org/#/swap?inputCurrency=${encodeURIComponent(input)}&outputCurrency=${encodeURIComponent(output)}`;
