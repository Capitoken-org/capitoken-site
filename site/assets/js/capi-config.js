// /assets/js/capi-config.js
// Configuración de red + WalletConnect (solo lectura y conexión)
window.CAPI_CONFIG = {
  // Red preferida: "0x1" Mainnet, "0xaa36a7" Sepolia, etc.
  PREFERRED_CHAIN_HEX: "0x1",

  // RPC solo-lectura (opcional). Si no lo pones, se usa el provider conectado
  // o un fallback público de ethers.
  RPC_URL: "",

  // Dirección del contrato cuando lo tengas (por ahora puede ir vacío):
  CONTRACT_ADDRESS: "",

  // WalletConnect v2 (Project ID): https://cloud.walletconnect.com
  WALLETCONNECT_PROJECT_ID: "YOUR_WALLETCONNECT_PROJECT_ID"
};

