(function(){
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // ---- Contador
  function toParts(diff){
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = Math.floor(diff % 60);
    return { d, h, m, s };
  }

  function startCountdown(){
    const iso = (window.CAPI_CONFIG && window.CAPI_CONFIG.LAUNCH_ISO) || null;
    if(!iso) return;

    const target = Math.floor(new Date(iso).getTime() / 1000);
    const update = () => {
      const now = Math.floor(Date.now()/1000);
      let diff = target - now;
      if(diff < 0) diff = 0;
      const p = toParts(diff);
      $("#d").textContent = p.d;
      $("#h").textContent = p.h;
      $("#m").textContent = p.m;
      $("#s").textContent = p.s;
    };
    update();
    setInterval(update, 1000);
  }

  // ---- UI inicial
  function initUI(){
    // links DEX: se setean en capi-dex.js -> setDexLinks()
    // botones wallet: capi-wallets.js hace el wiring

    // (Opcional) Poblar métricas en falso hasta que tengamos API
    $("#px").textContent       = "—";
    $("#mc").textContent       = "—";
    $("#liq_usdc").textContent = "—";
    $("#liq_weth").textContent = "—";
  }

  document.addEventListener("DOMContentLoaded", function(){
    initUI();
    startCountdown();
  });
})();
