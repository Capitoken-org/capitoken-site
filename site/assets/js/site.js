// /assets/js/site.js
/* global ethers, CAPI_CONFIG, CAPI_WALLET */

(function () {
  const $ = (s) => document.querySelector(s);

  // --------- Countdown (igual que antes) ----------
  const LAUNCH_ISO = "2025-12-31T23:59:59Z"; // ajusta a tu fecha UTC
  const d = $("#d"), h = $("#h"), m = $("#m"), s = $("#s");
  function tick() {
    const now = new Date();
    const target = new Date(LAUNCH_ISO);
    let diff = Math.max(0, (target - now) / 1000);
    const days = Math.floor(diff / 86400);
    diff -= days * 86400;
    const hours = Math.floor(diff / 3600);
    diff -= hours * 3600;
    const mins = Math.floor(diff / 60);
    const secs = Math.floor(diff - mins * 60);
    d.textContent = String(days);
    h.textContent = String(hours);
    m.textContent = String(mins);
    s.textContent = String(secs);
  }
  tick();
  setInterval(tick, 1000);

  // --------- Web3 / Contrato (lectura y acciones) ----------
  let readProvider = null, provider = null, signer = null, contract = null;

  // ABI mínimo opcional (ajústalo al tuyo cuando lo tengas)
  const CAPI_ABI = [
    // { "inputs":[...], "name":"buy", "stateMutability":"payable", "type":"function" },
    // { "inputs":[...], "name":"claimRewards", "stateMutability":"nonpayable", "type":"function" },
  ];

  async function setupProviders() {
    // Si ya hay wallet conectada via módulo, úsala
    if (window.CAPI_WALLET?.getProvider()) {
      provider = window.CAPI_WALLET.getProvider();
      signer = window.CAPI_WALLET.getSigner();
    }

    // Read provider
    if (CAPI_CONFIG.RPC_URL) {
      readProvider = new ethers.providers.JsonRpcProvider(CAPI_CONFIG.RPC_URL);
    } else if (provider) {
      readProvider = provider;
    } else {
      readProvider = ethers.getDefaultProvider(); // fallback público
    }

    // Contrato (si existe address y ABI)
    if (CAPI_CONFIG.CONTRACT_ADDRESS && CAPI_ABI.length) {
      contract = new ethers.Contract(CAPI_CONFIG.CONTRACT_ADDRESS, CAPI_ABI, readProvider);
    }
  }

  // Ejemplo de acción de compra (cuando haya contrato/ABI)
  async function handleBuy() {
    try {
      if (!window.CAPI_WALLET) return alert("Conecta una wallet primero.");
      if (!window.CAPI_WALLET.isConnected()) {
        await window.CAPI_WALLET.connectInjected();
      }
      await window.CAPI_WALLET.ensureChain();

      provider = window.CAPI_WALLET.getProvider();
      signer = window.CAPI_WALLET.getSigner();

      if (!CAPI_CONFIG.CONTRACT_ADDRESS || !CAPI_ABI.length) {
        alert("Contrato aún no configurado. (Sección en construcción)");
        return;
      }
      const c = new ethers.Contract(CAPI_CONFIG.CONTRACT_ADDRESS, CAPI_ABI, signer);

      // const tx = await c.buy({ value: ethers.utils.parseEther("0.01") });
      // await tx.wait();
      alert("Demo: aquí iría la compra. (Contrato aún no enlazado)");
    } catch (e) {
      console.warn(e);
      alert(e?.reason || e?.error?.message || e?.message || "Error en la operación");
    }
  }

  // Bind acciones
  function bind() {
    $("#btnBuyDemo")?.addEventListener("click", handleBuy);
  }

  // Init
  async function init() {
    await setupProviders();
    bind();
  }

  // Carga ethers si no está incluido por CDN (lo incluimos en index.html, esto es redundante de seguridad)
  if (!window.ethers) {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js";
    s.onload = init;
    document.head.appendChild(s);
  } else {
    init();
  }
})();
