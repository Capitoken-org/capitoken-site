(function(){
  const $ = (s, r=document)=>r.querySelector(s);

  const cfg = {
    launchISO: "2025-10-17T19:17:17Z",
    chainName: "Ethereum Mainnet",
    tokenAddress: "0x0000000000000000000000000000000000000000",
    tokenomics: [
      { label:"Comunidad", pct:97, color:"#20c997" },
      { label:"Desarrolladores", pct:2, color:"#f59f0b" },
      { label:"Marketing", pct:1, color:"#9ca3af" }
    ]
  };

  // ==== Wallet Connection ====
  function short(a){return a?(a.slice(0,6)+"…"+a.slice(-4)):"";}
  async function connectWallet(){
    if(!window.ethereum){alert("No se detectó wallet (MetaMask/TrustWallet).");return;}
    try{
      const [acc]=await window.ethereum.request({method:"eth_requestAccounts"});
      $("#btnConnect").textContent="Conectada";
      $("#accountBadge").textContent=short(acc);
      $("#accountBadge").classList.remove("hide");
      $("#btnDisconnect").classList.remove("hide");
    }catch(e){alert("Error al conectar: "+e.message);}
  }
  function disconnectWallet(){
    $("#btnConnect").textContent="Conectar";
    $("#btnDisconnect").classList.add("hide");
    $("#accountBadge").classList.add("hide");
  }

  // ==== Countdown ====
  function startCountdown(){
    const target=new Date(cfg.launchISO).getTime()/1000;
    const update=()=>{
      const now=Date.now()/1000;
      let diff=target-now;if(diff<0)diff=0;
      const d=Math.floor(diff/86400);
      const h=Math.floor((diff%86400)/3600);
      const m=Math.floor((diff%3600)/60);
      const s=Math.floor(diff%60);
      $("#d").textContent=d;$("#h").textContent=h;$("#m").textContent=m;$("#s").textContent=s;
    };
    update();setInterval(update,1000);
  }

  // ==== Tokenomics Chart ====
  function drawTokenomics(){
    const c=$("#tokenChart");if(!c)return;
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

  // ==== Metrics (Demo) ====
  function fmt(n,d=2){return Number(n||0).toLocaleString(undefined,{maximumFractionDigits:d});}
  function updateMetrics(){
    const price=0.0000027+Math.random()*0.0000005;
    const circ=12_345_678_901+Math.floor(Math.random()*5e6);
    const mc=price*circ;
    $("#px").textContent=`$${fmt(price,8)}`;
    $("#mc").textContent=`$${fmt(mc,0)}`;
    $("#circ").textContent=`${fmt(circ,0)} CAPI`;
    $("#holders").textContent=fmt(18200+Math.random()*600,0);
    $("#tx24").textContent=fmt(1200+Math.random()*200,0);
  }

  // ==== Scroll Animations ====
  function revealOnScroll(){
    document.querySelectorAll('.fadein').forEach(el=>{
      if(el.getBoundingClientRect().top<window.innerHeight*0.9)
        el.classList.add('visible');
    });
  }

  // ==== Scroll Top ====
  function setupScrollTop(){
    const btn=$("#scrollTop");
    btn.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));
  }

  // ==== Setup ====
  function init(){
    $("#btnConnect")?.addEventListener("click",connectWallet);
    $("#btnDisconnect")?.addEventListener("click",disconnectWallet);
    $("#netPill").textContent=cfg.chainName;
    startCountdown();
    drawTokenomics();
    updateMetrics();
    setInterval(updateMetrics,15000);
    window.addEventListener("scroll",revealOnScroll);
    revealOnScroll();
    setupScrollTop();
  }

  document.addEventListener("DOMContentLoaded",init);
})();
