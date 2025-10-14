(function(){
  const $ = (s, r=document)=>r.querySelector(s);
  const fmt = (n,d=2)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:d});
  const short = a => a ? (a.slice(0,6)+"…"+a.slice(-4)) : "";

  // EDITA CUANDO TENGAS EL CONTRATO REAL Y RPC
  const cfg = {
    launchISO: "2025-10-17T19:17:17Z",
    chainName: "Ethereum Mainnet",
    tokenAddress: "0x0000000000000000000000000000000000000000", // ← PON AQUÍ CAPI
    rpcMainnet: "https://mainnet.infura.io/v3/8e2c3c00000000000000000000000000",
    tokenomics: [
      { label:"Comunidad (ventas + recompensas)", pct:97, color:"#20c997" },
      { label:"Desarrolladores", pct:2, color:"#f59f0b" },
      { label:"Marketing", pct:1, color:"#9ca3af" }
    ]
  };

  /* ====== Tema (dark/light) ====== */
  function toggleTheme(){
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
  }
  function initTheme(){
    const saved = localStorage.getItem('theme');
    if(saved==='light') document.body.classList.add('light');
  }

  /* ====== Wallets ====== */
  async function connectInjected(){
    if(!window.ethereum){ alert("No se detectó wallet (MetaMask/Trust/Brave)."); return; }
    try{
      const [acc] = await window.ethereum.request({ method:"eth_requestAccounts" });
      $("#accountBadge").textContent = short(acc);
      $("#accountBadge").classList.remove("hide");
      $("#btnDisconnect").classList.remove("hide");
      // cierre modal si estaba abierto
      hideWalletModal();
    }catch(e){ alert(e?.message || "Error al conectar la wallet"); }
  }
  function disconnectWallet(){
    $("#btnDisconnect").classList.add("hide");
    $("#accountBadge").classList.add("hide");
  }

  /* ====== Countdown ====== */
  function startCountdown(){
    const target = new Date(cfg.launchISO).getTime()/1000;
    const tick = ()=>{
      const now=Date.now()/1000;
      let diff = target-now; if(diff<0) diff=0;
      const d=Math.floor(diff/86400), h=Math.floor((diff%86400)/3600),
            m=Math.floor((diff%3600)/60), s=Math.floor(diff%60);
      $("#d").textContent=d; $("#h").textContent=h; $("#m").textContent=m; $("#s").textContent=s;
    };
    tick(); setInterval(tick,1000);
  }

  /* ====== Tokenomics Chart (97/2/1) ====== */
  function drawTokenomics(){
    const c=$("#tokenChart"); if(!c) return;
    const ctx=c.getContext("2d");
    const cx=c.width/2, cy=c.height/2, r=Math.min(cx,cy)-10;
    let start=-Math.PI/2;
    cfg.tokenomics.forEach(slice=>{
      const ang=(slice.pct/100)*2*Math.PI;
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,r,start,start+ang);
      ctx.closePath(); ctx.fillStyle=slice.color; ctx.fill();
      start+=ang;
    });
  }

  /* ====== Métricas demo + lectura on-chain ====== */
  function updateMetricsDemo(){
    const price=0.0000027+Math.random()*0.0000005;
    const circ=12_345_678_901+Math.floor(Math.random()*5e6);
    const mc=price*circ;
    const EL = {
      px: $("#px"), mc: $("#mc"), circ: $("#circ"),
      holders: $("#holders"), tx24: $("#tx24"),
      liq_usdc: $("#liq_usdc"), liq_weth: $("#liq_weth")
    };
    if(EL.px) EL.px.textContent = `$${fmt(price,8)}`;
    if(EL.mc) EL.mc.textContent = `$${fmt(mc,0)}`;
    if(EL.circ) EL.circ.textContent = `${fmt(circ,0)} CAPI`;
    if(EL.holders) EL.holders.textContent = fmt(18200+Math.random()*600,0);
    if(EL.tx24) EL.tx24.textContent = fmt(1200+Math.random()*200,0);
    if(EL.liq_usdc) EL.liq_usdc.textContent = `$${fmt(250000+Math.random()*50000,0)}`;
    if(EL.liq_weth) EL.liq_weth.textContent = `$${fmt(180000+Math.random()*40000,0)}`;
  }
  async function readOnChainSupply(){
    try{
      if(!cfg.tokenAddress || cfg.tokenAddress.startsWith("0x0000")) return;
      const provider = new ethers.JsonRpcProvider(cfg.rpcMainnet);
      const abi = [
        "function totalSupply() view returns (uint256)",
        "function decimals() view returns (uint8)"
      ];
      const c = new ethers.Contract(cfg.tokenAddress, abi, provider);
      const [supply, decimals] = await Promise.all([c.totalSupply(), c.decimals()]);
      const total = Number(supply) / 10 ** Number(decimals);
      const circEl = $("#circ");
      if(circEl) circEl.textContent = `${fmt(total,0)} CAPI`;

      const priceTxt = $("#px")?.textContent?.replace("$","") || "0";
      const price = Number(priceTxt.split(",").join(""));
      if(price>0) $("#mc").textContent = `$${fmt(total*price,0)}`;
    }catch(e){ console.warn("No se pudo leer on-chain supply:", e); }
  }

  /* ====== DEX links ====== */
  function uniswapUrl(input, output){
    const base="https://app.uniswap.org/#/swap";
    return `${base}?theme=${document.body.classList.contains('light')?'light':'dark'}&inputCurrency=${encodeURIComponent(input)}&outputCurrency=${encodeURIComponent(output)}`;
  }
  function setDexLinksAndWidget(){
    const out = cfg.tokenAddress || "0x0000000000000000000000000000000000000000";
    $("#dexEth").href  = uniswapUrl("ETH", out);
    $("#dexUsdc").href = uniswapUrl("0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", out);
    $("#dexUsdt").href = uniswapUrl("0xdAC17F958D2ee523a2206206994597C13D831ec7", out);
    $("#dexDai").href  = uniswapUrl("0x6B175474E89094C44Da98b954EedeAC495271d0F", out);
    const widget=$("#uniswapWidget");
    if(widget) widget.src = uniswapUrl("ETH", out);
  }

  /* ====== Actividad dummy ====== */
  function seedActivity(){
    const body=$("#txBody"); if(!body) return;
    const rows=[
      {buyer:"0xAbC…1a2b",tokens:120000,amount:"0.50 ETH",tx:"0xtxhash1"},
      {buyer:"0xF00…9988",tokens:350000,amount:"1,200 USDC",tx:"0xtxhash2"},
      {buyer:"0x9De…77af",tokens: 98000,amount:"0.22 ETH",tx:"0xtxhash3"},
      {buyer:"0x7aB…44cd",tokens:510000,amount:"2,000 USDT",tx:"0xtxhash4"}
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

  /* ====== Live Token Tracker (Chart.js) ====== */
  let priceChart;
  function initPriceChart(){
    const ctx = $("#priceChart");
    if(!ctx) return;
    const labels = []; const data = [];
    for(let i=59;i>=0;i--){labels.push(`${i}m`); data.push(0.0000024 + Math.random()*0.0000006);}
    priceChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Precio (USD)",
          data,
          borderWidth: 2,
          tension: .25,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { ticks: { display: false }, grid: { display:false } },
          y: { ticks: { color: getComputedStyle(document.body).getPropertyValue('--text') }, grid: { color: getComputedStyle(document.body).getPropertyValue('--stroke') } }
        },
        plugins: { legend: { display:false } }
      }
    });
  }
  function pushChartPoint(){
    if(!priceChart) return;
    const next = 0.0000024 + Math.random()*0.0000006;
    const ds = priceChart.data.datasets[0].data;
    ds.push(next); ds.shift();
    priceChart.update("none");
    $("#tkPrice").textContent = `$${fmt(next,8)}`;
    $("#tkVol").textContent = `$${fmt(50000 + Math.random()*15000,0)}`;
    $("#tkLiq").textContent = `$${fmt(300000 + Math.random()*60000,0)}`;
    const circTxt = $("#circ")?.textContent?.replace(" CAPI","") || "0";
    const circ = Number(circTxt.split(",").join(""));
    if(circ>0) $("#tkMc").textContent = `$${fmt(circ*next,0)}`;
  }

  /* ====== Animaciones y utilidades ====== */
  function revealOnScroll(){
    document.querySelectorAll('.fadein').forEach(el=>{
      if(el.getBoundingClientRect().top<window.innerHeight*0.9)
        el.classList.add('visible');
    });
  }
  function setupScrollTop(){
    $("#scrollTop")?.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));
  }

  /* ====== Modal wallets ====== */
  function showWalletModal(){ $("#walletModal").classList.remove("hide"); }
  function hideWalletModal(){ $("#walletModal").classList.add("hide"); }
  function wireWalletModal(){
    $("#btnWallets")?.addEventListener("click", showWalletModal);
    $("#wmClose")?.addEventListener("click", hideWalletModal);
    document.addEventListener("click",(e)=>{
      if(e.target?.id==="walletModal") hideWalletModal();
    });
    document.querySelectorAll(".wallet-btn").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const w=btn.getAttribute("data-wallet");
        if(w==="metamask"){ connectInjected(); }
        else{ alert("Este wallet será integrado en la siguiente etapa."); }
      });
    });
  }

  /* ====== Wire & boot ====== */
  function wire(){
    $("#btnDisconnect")?.addEventListener("click", disconnectWallet);
    $("#netPill").textContent = cfg.chainName;
    $("#themeToggle")?.addEventListener("click", ()=>{
      toggleTheme();
      // refrescar colores del widget y chart
      setDexLinksAndWidget();
      if(priceChart){ priceChart.options.scales.y.ticks.color = getComputedStyle(document.body).getPropertyValue('--text'); priceChart.options.scales.y.grid.color = getComputedStyle(document.body).getPropertyValue('--stroke'); priceChart.update(); }
    });
    window.addEventListener("scroll", revealOnScroll);
    setupScrollTop();
    wireWalletModal();
    setDexLinksAndWidget();
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    initTheme();
    wire();
    startCountdown();
    drawTokenomics();
    updateMetricsDemo();
    seedActivity();
    revealOnScroll();

    // Live tracker
    initPriceChart();
    setInterval(pushChartPoint, 5000);

    // refrescos demo
    setInterval(updateMetricsDemo, 15000);

    // on-chain supply si hay contrato
    readOnChainSupply();
    setInterval(readOnChainSupply, 60000);

    // cambios de cuenta
    if(window.ethereum){
      window.ethereum.on?.("accountsChanged", (accs)=>{
        const acc=accs?.[0];
        if(acc){ $("#accountBadge").textContent=short(acc); $("#accountBadge").classList.remove("hide"); $("#btnDisconnect").classList.remove("hide"); }
        else{ disconnectWallet(); }
      });
    }
  });
})();
