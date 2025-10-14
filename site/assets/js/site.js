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
    ],
    // API endpoints para precio (se intentan en orden)
    priceAPIs: [
      // DexScreener (ej. si supiéramos par): `https://api.dexscreener.com/latest/dex/tokens/${token}`
      null, // placeholder, no hay par oficial aún
      // CoinGecko simple price por id/símbolo (cuando tengamos listing)
      null
    ]
  };

  /* ====== Dev Panel ====== */
  let devMode = false;
  const dev = {
    el: null,
    logEl: null,
    init(){
      this.el = $("#devPanel");
      this.logEl = $("#devLog");
      $("#devClear")?.addEventListener("click", ()=> this.clear());
      // tecla "~" activa/desactiva
      document.addEventListener("keydown",(e)=>{
        if(e.key === "~"){
          devMode = !devMode;
          this.el?.classList.toggle("hide", !devMode);
          this.log("Dev mode " + (devMode?"ON":"OFF"));
        }
      });
    },
    log(msg){
      try { console.log("[CAPI]", msg); } catch(_) {}
      if(!this.logEl) return;
      const t = new Date().toLocaleTimeString();
      this.logEl.textContent += `[${t}] ${typeof msg==='string'?msg:JSON.stringify(msg)}\n`;
      this.logEl.scrollTop = this.logEl.scrollHeight;
    },
    clear(){ if(this.logEl) this.logEl.textContent = ""; }
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
      hideWalletModal();
      dev.log("Wallet conectada: " + acc);
      // red
      const ch = await window.ethereum.request({ method:"eth_chainId" });
      dev.log("chainId: " + ch);
    }catch(e){ alert(e?.message || "Error al conectar la wallet"); dev.log(e); }
  }
  function connectWalletConnect(){
    // Placeholder: integración con SDK WalletConnect v2 en próxima tanda.
    alert("WalletConnect se integrará con el SDK en la siguiente versión.");
    dev.log("WalletConnect placeholder abierto");
  }
  function disconnectWallet(){
    $("#btnDisconnect").classList.add("hide");
    $("#accountBadge").classList.add("hide");
    dev.log("Wallet desconectada");
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

  /* ====== Precio (API) ====== */
  async function fetchPriceFromAPIs(){
    // Por ahora, sin par/listing no hay endpoint fiable; devolvemos null.
    dev.log("Precio API: sin endpoint configurado (simulado).");
    return null;
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

      dev.log({onChainSupply: total});
    }catch(e){ console.warn("No se pudo leer on-chain supply:", e); dev.log(e); }
  }

  /* ====== DEX links + Uniswap widget (lazy) ====== */
  function uniswapUrl(input, output){
    const theme = document.body.classList.contains('light') ? 'light' : 'dark';
    const base="https://app.uniswap.org/#/swap";
    return `${base}?theme=${theme}&inputCurrency=${encodeURIComponent(input)}&outputCurrency=${encodeURIComponent(output)}`;
  }
  function setDexLinksAndWidget(){
    const out = cfg.tokenAddress || "0x0000000000000000000000000000000000000000";
    $("#dexEth").href  = uniswapUrl("ETH", out);
    $("#dexUsdc").href = uniswapUrl("0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", out);
    $("#dexUsdt").href = uniswapUrl("0xdAC17F958D2ee523a2206206994597C13D831ec7", out);
    $("#dexDai").href  = uniswapUrl("0x6B175474E89094C44Da98b954EedeAC495271d0F", out);
    const widget=$("#uniswapWidget");
    if(widget){
      // lazy: solo poner src cuando entra en viewport
      if("IntersectionObserver" in window){
        const obs = new IntersectionObserver(entries=>{
          entries.forEach(en=>{
            if(en.isIntersecting){
              const ds = widget.getAttribute("data-src");
              if(ds) widget.setAttribute("src", ds);
              obs.disconnect();
              dev.log("Uniswap widget lazy-loaded");
            }
          });
        }, {root:null, threshold:.1});
        obs.observe(widget);
      }else{
        const ds = widget.getAttribute("data-src");
        if(ds) widget.setAttribute("src", ds);
      }
    }
  }

  /* ====== Actividad: Transfer feed (on-chain si hay contrato, de lo contrario simulado) ====== */
  async function loadRecentTransfers(){
    const body=$("#txBody"); if(!body) return;
    body.innerHTML = "";
    if(!cfg.tokenAddress || cfg.tokenAddress.startsWith("0x0000")){
      // Simulado
      const demo = [
        {from:"0x7fA…1b2c", to:"0x9aD…77af", amount: 120000, tx:"0xfeed01"},
        {from:"0xAbC…1a2b", to:"0x000…dead", amount:  98000, tx:"0xfeed02"},
        {from:"0xF00…9988", to:"0xDee…beef", amount: 510000, tx:"0xfeed03"},
        {from:"0x7aB…44cd", to:"0x0Aa…1234", amount:  22000, tx:"0xfeed04"},
      ];
      body.innerHTML = demo.map(r=>(
        `<tr>
          <td class="mono">${r.from}</td>
          <td class="mono">${r.to}</td>
          <td>${fmt(r.amount,0)}</td>
          <td><a href="#" target="_blank" rel="noreferrer">${r.tx}</a></td>
        </tr>`
      )).join("");
      dev.log("Transfer feed simulado cargado");
      return;
    }
    // On-chain (cuando tengamos contrato)
    try{
      const provider = new ethers.JsonRpcProvider(cfg.rpcMainnet);
      // topic Transfer(address,address,uint256)
      const topic = ethers.id("Transfer(address,address,uint256)");
      const latest = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latest - 5000);
      const logs = await provider.getLogs({ address: cfg.tokenAddress, topics: [topic], fromBlock, toBlock: latest });
      const iface = new ethers.Interface(["event Transfer(address indexed from,address indexed to,uint256 value)"]);
      const rows = logs.slice(-10).reverse().map(l=>{
        const { args } = iface.parseLog(l);
        return {
          from: short(args[0]),
          to: short(args[1]),
          amount: Number(args[2]) / 1e8, // 8 decimales
          tx: l.transactionHash
        };
      });
      body.innerHTML = rows.map(r=>(
        `<tr>
          <td class="mono">${r.from}</td>
          <td class="mono">${r.to}</td>
          <td>${fmt(r.amount,0)}</td>
          <td><a href="https://etherscan.io/tx/${r.tx}" target="_blank" rel="noreferrer">${r.tx.slice(0,10)}…</a></td>
        </tr>`
      )).join("");
      dev.log({transfer_count: rows.length});
    }catch(e){ console.warn("No se pudo leer Transfer logs:", e); dev.log(e); }
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
        animation: { duration: 300 },
        scales: {
          x: { ticks: { display: false }, grid: { display:false } },
          y: { ticks: { color: getComputedStyle(document.body).getPropertyValue('--text') }, grid: { color: getComputedStyle(document.body).getPropertyValue('--stroke') } }
        },
        plugins: { legend: { display:false } }
      }
    });
    dev.log("Chart inicializado");
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
  function setupParallax(){
    const b = $(".parallax");
    if(!b) return;
    window.addEventListener("scroll", ()=>{
      const y = window.scrollY || 0;
      b.style.transform = `translateY(${Math.min(8, y*0.02)}px)`;
    });
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
        else if(w==="walletconnect"){ connectWalletConnect(); }
        else{ alert("Este wallet será integrado en la siguiente etapa."); dev.log("Wallet por integrar: "+w); }
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
      if(priceChart){
        priceChart.options.scales.y.ticks.color = getComputedStyle(document.body).getPropertyValue('--text');
        priceChart.options.scales.y.grid.color = getComputedStyle(document.body).getPropertyValue('--stroke');
        priceChart.update();
      }
    });
    window.addEventListener("scroll", revealOnScroll);
    setupScrollTop();
    setupParallax();
    wireWalletModal();
    setDexLinksAndWidget();
  }

  document.addEventListener("DOMContentLoaded", async ()=>{
    dev.init(); dev.log("Booting CAPI UI…");
    initTheme();
    wire();
    startCountdown();
    drawTokenomics();
    updateMetricsDemo();
    revealOnScroll();

    // Intento de precio API (si tuviéramos endpoint)
    const apiPrice = await fetchPriceFromAPIs();
    if(apiPrice){ $("#px").textContent = `$${fmt(apiPrice,8)}`; dev.log({price_api: apiPrice}); }

    // Live tracker
    initPriceChart();
    setInterval(pushChartPoint, 5000);

    // refrescos demo
    setInterval(updateMetricsDemo, 15000);

    // on-chain supply & transfers si hay contrato
    readOnChainSupply();
    loadRecentTransfers();
    setInterval(readOnChainSupply, 60000);
    setInterval(loadRecentTransfers, 45000);

    // cambios de cuenta
    if(window.ethereum){
      window.ethereum.on?.("accountsChanged", (accs)=>{
        const acc=accs?.[0];
        if(acc){ $("#accountBadge").textContent=short(acc); $("#accountBadge").classList.remove("hide"); $("#btnDisconnect").classList.remove("hide"); dev.log("accountsChanged:"+acc); }
        else{ disconnectWallet(); }
      });
      window.ethereum.on?.("chainChanged", (ch)=>{
        dev.log("chainChanged:"+ch);
      });
    }
  });
})();
