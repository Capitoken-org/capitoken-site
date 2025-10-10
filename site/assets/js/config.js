// Configuración global Capitoken
window.CAPI_CONFIG = {
  // Fecha/hora de lanzamiento en UTC (ISO 8601)
  LAUNCH_ISO: "2025-10-17T19:17:17Z",

  // Dirección del contrato (pon la real al desplegar)
  CONTRACT_ADDRESS: "0xYOUR_CAPITOKEN_CONTRACT",

  // Red principal (0x1 = Ethereum mainnet)
  CHAIN_ID_HEX: "0x1",

  // Tokens conocidos (para armar rutas rápidas a Uniswap)
  TOKENS: {
    ETH:  "ETH",
    USDC: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI:  "0x6B175474E89094C44Da98b954EedeAC495271d0F"
  }
};
