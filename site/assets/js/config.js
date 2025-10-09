// ========================
// CONFIGURACIÓN CAPITOKEN
// ========================
window.CAPI_CONFIG = {
  DEMO: true,                 // true = datos ficticios / sin contrato
  CONTRACT_ADDRESS: "",       // "0x..." cuando despliegues
  CHAIN_ID_HEX: "0x1",        // 0x1 mainnet, 0xaa36a7 Sepolia, etc.
  RPC_URL: "",                // opcional (Infura/Alchemy) para lectura pública

  // Enlaces rápidos Uniswap (usamos dirección si está lista, si no placeholder)
  TOKEN_ADDRESS: "",          // 0x... de CAPI (para construir URLs de swap)
  TOKENS: {
    ETH: "ETH",
    USDC: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI:  "0x6B175474E89094C44Da98b954EedeAC495271d0F"
  },

  // (Opcional) PARES UNISWAP V2 para calcular precio on-chain rápido.
  // Llena con las direcciones de los pares CAPI/WETH y CAPI/USDC si los creas.
  UNISWAP_V2_PAIRS: {
    WETH: "",  // "0xParCAPI-WETH"
    USDC: ""   // "0xParCAPI-USDC"
  }
};

// Helpers: construir URL de swap uniswap
window.uniswapUrl = (input, output) =>
  `https://app.uniswap.org/#/swap?inputCurrency=${encodeURIComponent(input)}&outputCurrency=${encodeURIComponent(output)}`;
