// /assets/js/config.js
// Configuración general del sitio / dApp

window.CAPI_CONFIG = {
  // --- Red principal a usar en la dApp (hex) ---
  // 0x1 = Ethereum Mainnet, 0xaa36a7 = Sepolia
  PREFERRED_CHAIN_HEX: "0x1",

  // RPC opcional para solo-lectura (si no, usa el provider conectado o el default de ethers)
  RPC_URL: "",

  // Dirección del contrato (si aún no está desplegado déjalo vacío)
  CONTRACT_ADDRESS: "",

  // WalletConnect v2 - Consigue un Project ID gratis en https://cloud.walletconnect.com
  WALLETCONNECT_PROJECT_ID: "YOUR_WALLETCONNECT_PROJECT_ID"
};
