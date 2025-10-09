/* global ethers, Chart, CAPI_CONFIG, CAPI_ABI, PAIR_ABI, uniswapUrl */
(function(){
  const $ = (s) => document.querySelector(s);
  const fmt = (n, d=2) => {
    if (n===undefined||n===null) return "—";
    const x = Number(n);
    if (!isFinite(x)) return String(n);
    return x.toLocaleString(undefined,{maximumFractionDigits:d});
  };
  const fromWei = (bn, dec=18) => Number(bn)/10**dec;

  // ========= DOM refs =========
  const el = {
    circ: $("#circ"),
    unl: $("#unl"),
    day: $("#day"),
    mx: $("#mx"),
    priceUsd: $("#priceUsd"),
    mcUsd: $("#mcUsd"),
    nextDay: $("#nextDay"),
    incLabel: $("#incLabel"),
    shortAcc: $("#shortAcc"),
    locked: $("#locked"),
    calcIn: $("#calcIn"),
    calcOut: $("#calcOut"),
    ethAmount: $("#ethAmount"),
    msg: $("#msg"),
    btnConnect: $("#btnConnect"),
    btnBuy: $("#btnBuy"),
    btnClaim: $("#btnClaim"),
    uEth: $("#uEth"),
    uUsdc: $("#uUsdc"),
    uUsdt: $("#uUsdt"),
    uDai: $("#uDai"),
    txBody: $("#txBody")
  };

  // ========= Estado global =========
  let provider=null, readProvider=null, signer=null, account=null, chainId=null;
  let contract=null, decimals=8, chart=null;

  // ========= Helpers UI =========
  function setDexLinks(){
    const out = CAPI_CONFIG.TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";
    el.uEth.href  = uniswapUrl(CAPI_CONFIG.TOKENS.ETH, out);
    el.uUsdc.href = uniswapUrl(CAPI_CONFIG.TOKENS.USDC, out);
    el.uUsdt.href = uniswapUrl(CAPI_CONFIG.TOKENS.USDT, out);
    el.uDai.href  = uniswapUrl(CAPI_CONFIG.TOKENS.DAI, out);
  }

  function incentiveLabel(day){
    if (!day) return "—";
    if (day <= 30) return `Día ${day}: x${31-day}`;
    if (day <= 365) return `+5% mensual`;
    return "Sin bonus";
  }

  function nextDayCountdown(launch){
    if (!launch) return "—";
    const now = Math.floor(Date.now()/1000);
    const elapsed = now - launch;
    const next = launch + Math.floor(elapsed/86400 + 1)*86400;
    let s = next-now;
    if (s<0) s=0;
    const d = Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60);
    return `${d}d ${h}h ${m}m`;
  }

  function short(addr){ return addr ? addr.slice(0,6)+"…"+addr.slice(-4) : ""; }

  // ========= Conexión =========
  async function connectInjected(){
    try{
      if (!window.ethereum){ alert("No se detectó wallet inyectada."); return; }
      const [acc] = await window.ethereum.request({ method:"eth_requestAccounts" });
      const ch = await window.ethereum.request({ method:"eth_chainId" });
      account=acc; chainId=ch;
      el.shortAcc.textContent = short(account);
      const { ethers } = window;
      provider = new ethers.providers.Web3Provider(window.ethereum);
      signer = provider.getSigner();
      await setupReadProvider();
      el.msg.textContent = "";
    }catch(e){ console.warn(e); alert("No se pudo conectar."); }
  }

  async function setupReadProvider(){
    try{
      const { ethers } = window;
      if (CAPI_CONFIG.RPC_URL){
        readProvider = new ethers.providers.JsonRpcProvider(CAPI_CONFIG.RPC_URL);
      } else if (provider){
        readProvider = provider;
      } else {
        readProvider = ethers.getDefaultProvider(); // fallback público
      }
      if (CAPI_CONFIG.CONTRACT_ADDRESS){
        contract = new ethers.Contract(CAPI_CONFIG.CONTRACT_ADDRESS, CAPI_ABI, readProvider);
      }
    }catch(e){ console.warn("readProvider error", e); }
  }

  // ========= Datos (DEMO vs Real) =========
  async function loadData(){
    try{
      setDexLinks();
      // Año en footer
      $("#y").textContent = new Date().getFullYear();
      // Máximo fijo visible
      el.mx.textContent = "100B";

      if (CAPI_CONFIG.DEMO || !contract){
        // --- DEMO DATA ---
        const launch = Math.floor(Date.now()/1000) - 7*86400;
        const day = 8;
        decimals = 8;
        const circ = 12_500_000_000 * 10**decimals;
        const unl  = 8_333_000_000 * 10**decimals;
        el.circ.textContent = fmt(fromWei(circ,decimals));
        el.unl.textContent  = fmt(fromWei(unl,decimals));
        el.day.textContent  = day;
        el.nextDay.textContent = nextDayCountdown(launch);
        el.incLabel.textContent = incentiveLabel(day);
        el.locked.textContent = "0 CAPI";

        // Precio demo y chart
        const demoPrice = 0.0000025; // USD
        el.priceUsd.textContent = `$${fmt(demoPrice,8)}`;
        el.mcUsd.textContent = `$${fmt(demoPrice*fromWei(circ,decimals),0)}`;
        drawChart(makeDemoSeries());
        drawActivityDemo();
        return;
      }

      // --- REAL DATA ---
      const [dec, day, circ, unl, launch, vestEnd] = await Promise.all([
        contract.decimals(), contract.currentDay(), contract.circulatingSupply(),
        contract.unlockedCommunitySupply(), contract.launchTime(), contract.rewardsVestingEnd()
      ]);
      decimals = Number(dec);
      el.circ.textContent = fmt(fromWei(circ,decimals));
      el.unl.textContent  = fmt(fromWei(unl,decimals));
      el.day.textContent  = Number(day);
      el.incLabel.textContent = incentiveLabel(Number(day));
      el.nextDay.textContent  = nextDayCountdown(Number(launch));

      // locked del usuario (si conectado)
      if (account && contract){
        const lr = await contract.lockedRewards(account);
        el.locked.textContent = `${fmt(fromWei(lr,decimals))} CAPI`;
      }

      // Precio (si configuras pares Uniswap V2)
      const price = await tryFetchPriceUSD();
      if (price){
        el.priceUsd.textContent = `$${fmt(price,8)}`;
        el.mcUsd.textContent = `$${fmt(price*fromWei(circ,decimals),0)}`;
      } else {
        el.priceUsd.textContent = "—";
        el.mcUsd.textContent = "—";
      }

      // Chart placeholder (podemos mejorar con TheGraph más adelante)
      drawChart(makeDemoSeries());

      // Actividad reciente
      await loadActivity();
    }catch(e){ console.warn(e); }
  }

  // ========= Precio desde pares Uniswap V2 (opcional) =========
  async function tryFetchPriceUSD(){
    try{
      const { UNISWAP_V2_PAIRS } = CAPI_CONFIG;
      if (!UNISWAP_V2_PAIRS.WETH && !UNISWAP_V2_PAIRS.USDC) return null;
      const { ethers } = window;
      // Preferimos USDC por ser estable
      if (UNISWAP_V2_PAIRS.USDC){
        const pair = new ethers.Contract(UNISWAP_V2_PAIRS.USDC, PAIR_ABI, readProvider);
        const [t0, t1] = await Promise.all([pair.token0(), pair.token1()]);
        const res = await pair.getReserves();
        // Ordena reserves según token0/token1
        // Asumimos que uno es USDC (6 dec) y el otro es CAPI (8 dec)
        const USDC = CAPI_CONFIG.TOKENS.USDC.toLowerCase();
        const token0 = t0.toLowerCase(); const token1 = t1.toLowerCase();
        let capiReserve, usdcReserve;
        if (token0 === USDC){ usdcReserve=res._reserve0; capiReserve=res._reserve1; }
        else if (token1 === USDC){ usdcReserve=res._reserve1; capiReserve=res._reserve0; }
        else return null;
        const price = (Number(usdcReserve)/1e6) / (Number(capiReserve)/10**decimals); // USD/CAPI
        return price;
      }
      // Si no hay USDC, intentamos WETH y convertimos usando un precio fijo de ETH (placeholder)
      if (UNISWAP_V2_PAIRS.WETH){
        const pair = new ethers.Contract(UNISWAP_V2_PAIRS.WETH, PAIR_ABI, readProvider);
        const [t0, t1] = await Promise.all([pair.token0(), pair.token1()]);
        const res = await pair.getReserves();
        // WETH 18 dec, CAPI 8 dec. Necesitamos precio ETH→USD (placeholder manual aquí)
        const ETH_USD = 3000; // <-- puedes inyectar un valor aproximado
        const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase();
        const token0 = t0.toLowerCase(); const token1 = t1.toLowerCase();
        let capiReserve, wethReserve;
        if (token0 === WETH){ wethReserve=res._reserve0; capiReserve=res._reserve1; }
        else if (token1 === WETH){ wethReserve=res._reserve1; capiReserve=res._reserve0; }
        else return null;
        const priceEth = (Number(wethReserve)/1e18) / (Number(capiReserve)/10**decimals);
        return priceEth*ETH_USD;
      }
      return null;
    }catch(e){ console.warn("price err", e); return null; }
  }

  // ========= Chart =========
  function makeDemoSeries(){
    const n=40, out=[];
    let x=0.000002, v=x;
    for(let i=0;i<n;i++){ v += (Math.random()-0.5)*x*0.1; out.push(Math.max(0,v)); }
    return out;
  }
  function drawChart(series){
    const ctx = document.getElementById("priceChart").getContext("2d");
    if (chart) chart.destroy();
    chart = new Chart(ctx,{
      type:"line",
      data:{ labels: series.map((_,i)=>i+1), datasets:[{ data:series, borderWidth:2, pointRadius:0 }] },
      options:{ responsive:true, plugins:{legend:{display:false}}, scales:{x:{display:false},y:{display:false}} }
    });
  }

  // ========= Actividad =========
  async function loadActivity(){
    try{
      const { ethers } = window;
      const currentBlock = await readProvider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 8000);
      const sig = ethers.utils.id('TokensPurchased(address,uint256,uint256,uint256)');
      const logs = await readProvider.getLogs({
        address: CAPI_CONFIG.CONTRACT_ADDRESS,
        topics: [sig], fromBlock, toBlock: currentBlock
      });
      const iface = new ethers.utils.Interface(CAPI_ABI);
      const last = logs.slice(-12).reverse();
      if (last.length===0){ el.txBody.innerHTML = `<tr><td colspan="5" class="muted">Sin eventos en el periodo reciente.</td></tr>`; return; }
      el.txBody.innerHTML = last.map(l=>{
        const { args } = iface.parseLog(l);
        const buyer = args[0];
        const ethSpent = Number(args[1])/1e18;
        const tokens = Number(args[2])/10**decimals;
        const rw = Number(args[3])/10**decimals;
        return `<tr>
          <td>${short(buyer)}</td>
          <td>${fmt(ethSpent,4)}</td>
          <td>${fmt(tokens,2)}</td>
          <td>${fmt(rw,2)}</td>
          <td><a target="_blank" href="https://etherscan.io/tx/${l.transactionHash}">Ver</a></td>
        </tr>`;
      }).join("");
    }catch(e){
      console.warn("activity err", e);
      el.txBody.innerHTML = `<tr><td colspan="5" class="muted">No se pudo cargar actividad.</td></tr>`;
    }
  }
  function drawActivityDemo(){
    const rows = Array.from({length:6}).map((_,i)=>{
      const eth = (Math.random()*1.2).toFixed(3);
      const tok = Math.floor(Math.random()*250000)+60000;
      const rw  = Math.floor(tok*0.3);
      return `<tr>
        <td>0xAbC…${(1000+i)}</td>
        <td>${eth}</td>
        <td>${fmt(tok,0)}</td>
        <td>${fmt(rw,0)}</td>
        <td><span class="muted">demo</span></td>
      </tr>`;
    }).join("");
    el.txBody.innerHTML = rows;
  }

  // ========= Acciones =========
  async function buy(){
    if (CAPI_CONFIG.DEMO){ el.msg.textContent="(demo)"; return; }
    try{
      if (!signer){ await connectInjected(); if (!signer) return; }
      const c = new ethers.Contract(CAPI_CONFIG.CONTRACT_ADDRESS, CAPI_ABI, signer);
      el.msg.textContent = "Enviando transacción…";
      const tx = await c.buy({ value: ethers.utils.parseEther(el.ethAmount.value || "0") });
      await tx.wait();
      el.msg.textContent = "¡Compra confirmada!";
      await loadData();
    }catch(e){
      console.warn(e);
      el.msg.textContent = e?.error?.message || e?.data?.message || e?.message || "Error en la compra";
    }
  }
  async function claim(){
    if (CAPI_CONFIG.DEMO){ el.msg.textContent="(demo)"; return; }
    try{
      if (!signer){ await connectInjected(); if (!signer) return; }
      const c = new ethers.Contract(CAPI_CONFIG.CONTRACT_ADDRESS, CAPI_ABI, signer);
      el.msg.textContent = "Reclamando…";
      const tx = await c.claimRewards();
      await tx.wait();
      el.msg.textContent = "¡Recompensas reclamadas!";
      await loadData();
    }catch(e){
      console.warn(e);
      el.msg.textContent = e?.error?.message || e?.data?.message || e?.message || "Error al reclamar";
    }
  }

  function recalc(){
    const raw = Number(el.calcIn.value||"0");
    const d = Number(el.day.textContent||"0");
    if (!raw || !d){ el.calcOut.textContent = "—"; return; }
    let bonus = 0;
    if (d<=30) bonus = (31-d)*raw; // x30→x1
    else bonus = raw*0.05;         // aproximación al primer mes después de 30
    el.calcOut.textContent = fmt(bonus,2);
  }

  // ========= Init =========
  async function init(){
    try{
      el.btnConnect.addEventListener("click", connectInjected);
      el.btnBuy.addEventListener("click", buy);
      el.btnClaim.addEventListener("click", claim);
      el.calcIn.addEventListener("input", recalc);

      setDexLinks();
      await setupReadProvider();
      await loadData();
    }catch(e){ console.warn(e); }
  }
  init();
})();
