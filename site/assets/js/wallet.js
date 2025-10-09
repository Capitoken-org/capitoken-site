// /assets/js/wallets.js
/* global ethers, WalletConnectProvider, CAPI_CONFIG */
(function () {
  const $ = (s) => document.querySelector(s);
  const state = { provider: null, web3: null, signer: null, account: null, chainId: null, wc: null };

  const short = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");
  const setUI = () => {
    $("#shortAcc").textContent = state.account ? short(state.account) : "";
    $("#btnConnect").textContent = state.account ? "Conectado" : "Conectar";
  };

  async function ensureChain() {
    try {
      if (!state.provider || !CAPI_CONFIG.PREFERRED_CHAIN_HEX) return;
      const cur = await state.provider.request({ method: "eth_chainId" });
      if (cur !== CAPI_CONFIG.PREFERRED_CHAIN_HEX) {
        await state.provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: CAPI_CONFIG.PREFERRED_CHAIN_HEX }]
        });
      }
    } catch (e) {
      console.warn("switch chain", e);
    }
  }

  async function connectInjected() {
    try {
      if (!window.ethereum) {
        alert("No se detectó MetaMask/Trust/Brave. Prueba el botón WalletConnect.");
        return;
      }
      const prov = window.ethereum;
      const [acc] = await prov.request({ method: "eth_requestAccounts" });
      const chainId = await prov.request({ method: "eth_chainId" });

      state.provider = prov;
      state.web3 = new ethers.providers.Web3Provider(prov);
      state.signer = state.web3.getSigner();
      state.account = acc;
      state.chainId = chainId;

      prov.on?.("accountsChanged", (a) => {
        state.account = a?.[0] || null;
        setUI();
      });
      prov.on?.("chainChanged", (c) => {
        state.chainId = c;
      });

      setUI();
      await ensureChain();
    } catch (e) {
      console.warn(e);
      alert("No se pudo conectar la wallet inyectada.");
    }
  }

  async function connectWalletConnect() {
    try {
      if (!CAPI_CONFIG.WALLETCONNECT_PROJECT_ID) {
        alert('Configura WALLETCONNECT_PROJECT_ID en "/assets/js/config.js".');
        return;
      }
      const chainNum = parseInt(CAPI_CONFIG.PREFERRED_CHAIN_HEX, 16) || 1;
      const wcProv = await WalletConnectProvider.EthereumProvider.init({
        projectId: CAPI_CONFIG.WALLETCONNECT_PROJECT_ID,
        chains: [chainNum],
        showQrModal: true,
        qrModalOptions: { themeMode: "dark" }
      });
      await wcProv.connect();

      state.provider = wcProv;
      state.web3 = new ethers.providers.Web3Provider(wcProv);
      state.signer = state.web3.getSigner();
      state.account = wcProv.accounts?.[0] || null;
      state.chainId = "0x" + wcProv.chainId.toString(16);
      state.wc = wcProv;

      wcProv.on("accountsChanged", (a) => {
        state.account = a?.[0] || null;
        setUI();
      });
      wcProv.on("chainChanged", (c) => {
        state.chainId = "0x" + Number(c).toString(16);
      });
      wcProv.on("disconnect", () => {
        disconnect();
      });

      setUI();
      await ensureChain();
    } catch (e) {
      console.warn(e);
      if (!String(e).includes("close")) alert("No se pudo conectar con WalletConnect.");
    }
  }

  async function disconnect() {
    try {
      if (state.wc) await state.wc.disconnect();
    } catch (e) {}
    state.provider = state.web3 = state.signer = null;
    state.account = state.chainId = state.wc = null;
    setUI();
  }

  // API pública para site.js
  window.CAPI_WALLET = {
    getSigner: () => state.signer,
    getProvider: () => state.web3,
    getAccount: () => state.account,
    isConnected: () => !!state.account,
    connectInjected,
    connectWalletConnect,
    disconnect,
    ensureChain
  };

  // Botones
  function bind() {
    $("#btnConnect")?.addEventListener("click", () => {
      if (window.ethereum) connectInjected();
      else connectWalletConnect();
    });
    $("#w-mm")?.addEventListener("click", connectInjected);
    $("#w-tw")?.addEventListener("click", connectWalletConnect);   // Trust via WC
    $("#w-cbw")?.addEventListener("click", connectWalletConnect);  // Coinbase app via WC
  }
  bind();
})();

