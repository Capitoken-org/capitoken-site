(function(){
  const $ = (s, r=document)=>r.querySelector(s);

  const cfg = {
    launchISO: "2025-10-17T19:17:17Z",
    chainName: "Ethereum Mainnet",
    tokenAddress: "",
    tokenomics: [
      { label:"Comunidad (ventas + recompensas)", pct:97, color:"#20c997" },
      { label:"Desarrolladores", pct:2, color:"#f59f0b" },
      { label:"Marketing", pct:1, color:"#9ca3af" }
    ]
  };

  // ===== Wallet =====
  function short(a){ return a ? (a.slice(0,6)+"…"+a.slice(-4)) : ""; }

  async function connectInjected(){
    try{
      if(!window.ethereum){ alert("No se detectó wallet (MetaMask/Trust)."); return; }
      const [acc] = await window.ethereum.request({ method:"eth_requestAccounts" });
      $("#btnConnect").textContent="Conectada";
      $("#btnDisconnect").classList.remove("hide");
      $("#accountBadge").textContent=short(acc);
      $("#accountBadge").classList.remove("hide");
    }catch(e){
      alert(e?.message || "Error al conectar wallet");
    }
  }
  function disconnect(){
    $("#btnConnect").textContent="Conectar";
    $("#btnDisconnect").classList.add("hide");
    $("#accountBadge").classList.add("hide");
  }

  // ===== Countdown =====
  function startCountdown(){
    const target = new Date(cfg.launchISO).getTime()/1000;
    const update = ()=>{
      const now=Date.now()/1000;
      let diff = target-now; if(diff<0) diff=0;
      const d=Math.floor(diff/86400);
      const h=Math.floor((diff%86400)/3600);
      const m=Math.floor((diff%3600)/60);
      const s=Math.floor(diff%60);
      $("#d").textContent=d;$("#h").textContent=h;$("#m").textContent=m;$("#s").textContent=s;
    };
    update(); setInterval(update,1000);
  }

  // ===== Tokenomics Chart =====
  function drawTokenomics(){
    const c=$("#tokenChart"); if(!c) return;
    const ctx=c.getContext("2d");
    const cx=c.width/2,cy=c.height/2,r=Math.min(cx,cy)-10;
    let start=-Math.PI/2;
    cfg.tokenomics.forEach(slice=>{
      const ang=(slice.pct/100)*2*Math.PI;
      ctx.beginPath();ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,r,start,start+ang);
      ctx.closePath();ctx.fillStyle=slice.color;ctx.fill();
      start+=ang;
    });
  }

  // ===== Métricas simuladas =====
  function fmt(n,d=2){return Number(n||0).toLocaleString(undefined,{maximumFractionDigits:d})}
  function updateMetricsDemo(){
    const price=0.0000027+Math.random()*0.0000005;
    const circ=12_345_678_901+Math.floor(Math.random()*5e6);
    const mc=price*circ;
    $("#px").textContent=`$${fmt(price,8)}`;
    $("#mc").textContent=`$${fmt(mc,0)}`;
    $("#circ").textContent=`${fmt(circ,0)} CAPI`;
    $("#holders").textContent=fmt(18200+Math.random()*600,0);
    $("#tx24").textContent=fmt(1200+Math.random()*200,0);
    $("#liq_usdc").textContent=`$${fmt(250000+Math.random()*50000,0)}`;
    $("#liq_weth").textContent=`$${fmt(180000+Math.random()*40000,0)}`;
  }

  // ===== DEX links =====
  function uniswapUrl(input,output){
    const base="https://app.uniswap.org/#/swap";
    return `${base}?inputCurrency=${input}&outputCurrency=${output}`;
  }
  function setDexLinks(){
    const out=cfg.tokenAddress||"0x0000000000000000000000000000000000000000";
    $("#dexEth").href=uniswapUrl("ETH",out);
    $("#dexUsdc").href=uniswapUrl("0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",out);
    $("#dexUsdt").href=uniswapUrl("0xdAC17F958D2ee523a2206206994597C13D831ec7",out);
    $("#dexDai").href=uniswapUrl("0x6B175474E89094C44Da98b954EedeAC495271d0F",out);
  }

  // ===== Actividad dummy =====
  function seedActivity(){
    const body=$("#txBody");if(!body)return;
    const rows=[
      {buyer:"0xAbC…1a2b",tokens:120000,amount:"0.50 ETH",tx:"0xtxhash1"},
      {buyer:"0xF00…9988",tokens:350000,amount:"1,200 USDC",tx:"0xtxhash2"},
      {buyer:"0x9De…77af",tokens:98000,amount:"0.22 ETH",tx:"0xtxhash3"},
      {buyer:"0x7aB…44cd",tokens:510000,amount:"2,000 USDT",tx:"0xtxhash4"}
    ];
    body.innerHTML=rows.map(r=>
      `<tr><td>${r.buyer}</td><td>${fmt(r.tokens,0)}</td><td>${r.amount}</td><td><a href="#">${r.tx}</a></td></tr>`
    ).join("");
  }

  // ===== Scroll anim =====
  function revealOnScroll(){
    document.querySelectorAll('.fadein').forEach(el=>{
      if(el.getBoundingClientRect().top<window.innerHeight*0.9)
        el.classList.add('visible');
    });
  }

  // ===== Setup =====
  function wire(){
    $("#btnConnect")?.addEventListener("click",connectInjected);
    $("#btnDisconnect")?.addEventListener("click",disconnect);
    window.addEventListener('scroll',revealOnScroll);
    $("#netPill").textContent=cfg.chainName;
  }

  document.addEventListener("DOMContentLoaded",()=>{
    wire();
    startCountdown();
    drawTokenomics();
    updateMetricsDemo();
    setDexLinks();
    seedActivity();
    revealOnScroll();
    if(window.ethereum){
      window.ethereum.on?.("accountsChanged",accs=>{
        const acc=accs?.[0];
        if(acc){$("#accountBadge").textContent=short(acc);}else{disconnect();}
      });
    }
  });
})();
