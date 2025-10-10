(function (){
  const $ = (s, r=document) => r.querySelector(s);

  function short(addr){
    if(!addr) return "";
    return addr.slice(0,6)+"…"+addr.slice(-4);
  }

  async function connectInjected(){
    try{
      if(!window.ethereum){
        alert("No se detectó wallet inyectada (MetaMask/Trust/Brave).");
        return;
      }
      const accounts = await window.ethereum.request({ method:"eth_requestAccounts" });
      const acc = (accounts && accounts[0]) || null;

      const chainId = await window.ethereum.request({ method:"eth_chainId" });
      if (chainId !== window.CAPI_CONFIG.CHAIN_ID_HEX){
        // opcional: pedir cambio de red
        console.warn("Red distinta a la esperada:", chainId);
      }

      // UI
      $("#btnConnect").classList.add("small");
      $("#btnConnect").textContent = "Conectada";
      const badge = $("#accountBadge");
      badge.textContent = short(acc);
      badge.classList.remove("hide");
    }catch(e){
      console.warn(e);
      alert(e?.message || "No se pudo conectar la wallet");
    }
  }

  // Exponer global y wire básico
  window.CAPI_WALLETS = { connectInjected };

  document.addEventListener("click", (e)=>{
    const btn = e.target.closest(".wallet-btn[data-w='injected'], #btnConnect");
    if(btn){ connectInjected(); }
  });
})();
