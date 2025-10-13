(function(){
  const $ = (s, r=document)=>r.querySelector(s);
  const cfg = {
    // EDITA si quieres otra fecha (UTC ISO 8601)
    launchISO: "2025-10-17T19:17:17Z",

    // Red esperada (display informativo)
    chainName: "Ethereum Mainnet",

    // Dirección del contrato (para activar links DEX reales cuando lo tengas)
    tokenAddress: "", // "0xTU_CONTRATO"

    // Tokenomics reales (suma 100)
    tokenomics: [
      { label: "Comunidad (ventas + recompensas)", pct: 97, color: "#20c997" },
      { label: "Desarrolladores", pct: 2, color: "#f59f0b" },
      { label: "Marketing", pct: 1, color: "#9ca3af" }
    ]
  };

  // ===== Header / Wallet (inyectada) =====
  function short(a){ return a ? (a.slice(0,6)+"…"+a.slice(-4)) : ""; }

  async function connectInjected(){
    try{
      if(!window.ethereum){ alert("No se detectó wallet inyectada (MetaMask/Trust/Brave)."); return; }
      const [acc] = await window.ethereum.request({ method:"eth_requestAccounts" });
      $("#btnConnect").textContent="Conectada";
      $("#btnDisconnect").classList.remove("hide");
      const badge = $("#accountBadge");
      badge.textContent = short(acc);
      badge.classList.remove("hide");
    }catch(e){
      console.warn(e);
      alert(e?.message || "No se pudo conectar la wallet");
    }
  }
  function disconnect(){
    $("#btnConnect").textContent="Conectar";
    $("#btnDisconnect").classList.add("hide");
    const badge=$("#accountBadge");
    badge.textContent=""; badge.classList.add("hide");
  }

  // ===== Countdown =====
  function toParts(diff){
    const d=Math.floor(diff/86400);
    const h=Math.floor((diff%86400)/3600);
    const m=Math.floor((diff%3600)/60);
    const s=Math.floor(diff%60);
    return {d,h,m,s};
  }
  function startCountdown(){
    const target = new Date(cfg.launchISO).getTime()/1000;
    const update = ()=>{
      const now=Date.now()/1000;
      let diff = target-now; if(diff<0) diff=0;
      const p=toParts(diff);
      $("#d").textContent=p.d; $("#h").textContent=p.h; $("#m").textContent=p.m; $("#s").textContent=p.s;
    };
    update(); setInterval(update,1000);
  }

  // ===== Tokenomics Chart (canvas sin dependencias) =====
  function drawTokenomics(){
    const c = $("#tokenChart"); if(!c) return;
    const ctx = c.getContext("2d");
    const cx = c.width/2, cy = c.height/2, r = Math.min(cx,cy)-10;
    let start = -Math.PI/2; // arriba
    cfg.tokenomics.forEach(slice=>{
      const ang = (slice.pct/100)*2*Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,r,start,start+ang);
      ctx.closePath();
      ctx.fillStyle = slice.color; ctx.fill();
      start += ang;
    });
  }

  // ===== Métricas “en vivo” (simuladas) =====
  function fmt(n, d=2){
    if(n===null || n===undefined) return "—";
    const x = Number(n); if(!isFinite(x)) return "—";
    return x.toLocaleString(undefined, { maximumFractionDigits:d });
  }
  function updateMetricsDemo(){
    // Simulación: cambia cada carga (placeholders hasta tener APIs)
    const price = 0.0000027 + Math.random()*0.0000005;            // $CAPI aproximado
    const circ  = 12_345_678_901 + Math.floor(Math.random()*5e6);  // circulante
    const mc    = price * circ;
    const holders = 18230 + Math.floor(Math.random()*400);
    const tx24   = 1250 + Math.floor(Math.random()*220);
    const liqUsdc = 250_000 + Math.floor(Math.random()*50_000);
    const liqWeth = 180_000 + Math.floor(Math.random()*50_000);

    $("#px").textContent       = `$${fmt(price, 8)}`;
    $("#mc").textContent       = `$${fmt(mc, 0)}`;
    $("#circ").textContent     = `${fmt(circ, 0)} CAPI`;
    $("#holders").textContent  = fmt(holders, 0);
    $("#tx24").textContent     = fmt(tx24, 0);
    $("#liq_usdc").textContent = `$${fmt(liqUsdc, 0)}`;
    $("#liq_weth").textContent = `$${fmt(liqWeth, 0)}`;
  }

  // ===== DEX links (Uniswap) =====
  function uniswapUrl(input, output){
    const base = "https://app.uniswap.org/#/swap";
    const p = new URLSearchParams({ inputCurrency: input, outputCurrency: output });
    return `${base}?${p.toString()}`;
  }
  function setDexLinks(){
    const out = cfg.tokenAddress || "0x0000000000000000000000000000000000000000";
    $("#dexEth").href  = uniswapUrl("ETH", out);
    $("#dexUsdc").href = uniswapUrl("0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", out);
    $("#dexUsdt").href = uniswapUrl("0xdAC17F958D2ee523a2206206994597C13D831ec7", out);
    $("#dexDai").href  = uniswapUrl("0x6B175474E89094C44Da98b954EedeAC495271d0F", out);
  }

  // ===== Actividad reciente (dummy) =====
  function seedActivity(){
    const body = $("#txBody"); if(!body) return;
    const rows = [
      { buyer:"0xAbC…1a2b", tokens: 120000, amount:"0.50 ETH", tx:"0xtxhash1" },
      { buyer:"0xF00…9988", tokens: 350000, amount:"1,200 USDC", tx:"0xtxhash2" },
      { buyer:"0x9De…77af", tokens:  98000, amount:"0.22 ETH", tx:"0xtxhash3" },
      { buyer:"0x7aB…44cd", tokens: 510000, amount:"2,000 USDT", tx:"0xtxhash4" }
    ];
    body.innerHTML = rows.map(r=>(
      `<tr>
        <td class="mono">${r.buyer}</td>
        <td>${fmt(r.tokens,0)}</td>
        <td>${r.amount}</td>
        <td><a href="#" target="_blank" rel="noreferrer">${r.tx}</a></td>
      </tr>`
    )).join("");
  }

  // ===== Animaciones de aparición =====
  function revealOnScroll(){
    const els = document.querySelectorAll('.fadein');
    const trigger = window.innerHeight*0.9;
    els.forEach(el=>{
      const top = el.getBoundingClientRect().top;
      if(top<trigger) el.classList.add('visible');
    });
  }

  // ===== Wire básico =====
  function wire(){
    $("#btnConnect")?.addEventListener("click", connectInjected);
    $("#btnDisconnect")?.addEventListener("click", disconnect);
    $("#netPill").textContent = cfg.chainName || "Ethereum Mainnet";
    window.addEventListener('scroll', revealOnScroll);
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    wire();
    startCountdown();
    drawTokenomics();
    updateMetricsDemo();
    setDexLinks();
    seedActivity();
    revealOnScroll();

    // Si cambia la cuenta en la wallet, reflejar en UI
    if(window.ethereum){
      window.ethereum.on?.("accountsChanged", (accs)=>{
        const acc = accs?.[0];
        if(acc){
          $("#btnConnect").textContent="Conectada";
          $("#btnDisconnect").classList.remove("hide");
          const badge=$("#accountBadge");
          badge.textContent = short(acc);
          badge.classList.remove("hide");
        }else{
          disconnect();
        }
      });
    }
  });
})();
