(function (){
  const $ = (s, r=document) => r.querySelector(s);

  function short(addr){
    if(!addr) return "";
    return addr.slice(0,6) + "..." + addr.slice(-4);
  }

  async function connectInjected(){
    try{
      if(!window.ethereum){
        alert("No injected wallet detected (MetaMask/Brave/Trust)." );
        return;
      }

      const accounts = await window.ethereum.request({ method:"eth_requestAccounts" });
      const acc = (accounts && accounts[0]) || null;

      const chainId = await window.ethereum.request({ method:"eth_chainId" });
      const expected = (window.CAPI_CONFIG && window.CAPI_CONFIG.CHAIN_ID_HEX) || "0x1";
      if (chainId !== expected){
        console.warn("Unexpected chain:", chainId, "expected:", expected);
      }

      const btn = $("#btnConnect");
      if(btn){
        btn.classList.add("small");
        btn.textContent = "Wallet connected";
      }

      const badge = $("#accountBadge");
      if(badge){
        badge.textContent = short(acc);
        badge.classList.remove("hide");
      }
    }catch(e){
      console.warn(e);
      alert((e && e.message) ? e.message : "Could not connect wallet");
    }
  }

  window.CAPI_WALLETS = { connectInjected };

  document.addEventListener("click", (e)=>{
    const btn = e.target && e.target.closest && e.target.closest("#btnConnect, .wallet-btn[data-w='injected']");
    if(btn){ connectInjected(); }
  });
})();
