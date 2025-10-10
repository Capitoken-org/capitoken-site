// /site/assets/js/capi-dex.js
/* global ethers, CAPI_CONFIG, uniswapUrl */

(() => {
  const $ = (s) => document.querySelector(s);
  const fmt = (n, d = 2) => {
    if (n === undefined || n === null) return "—";
    const x = Number(n);
    if (!isFinite(x)) return String(n);
    return x.toLocaleString(undefined, { maximumFractionDigits: d });
  };

  const PAIR_ABI = [
    {"constant":true,"inputs":[],"name":"getReserves","outputs":[
      {"internalType":"uint112","name":"_reserve0","type":"uint112"},
      {"internalType":"uint112","name":"_reserve1","type":"uint112"},
      {"internalType":"uint32","name":"_blockTimestampLast","type":"uint32"}
    ],"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[],"name":"token0","outputs":[{"type":"address"}],"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[],"name":"token1","outputs":[{"type":"address"}],"stateMutability":"view","type":"function"}
  ];

  let readProvider;

  async function getReadProvider() {
    const { ethers } = window;
    if (CAPI_CONFIG.RPC_URL) {
      return new ethers.providers.JsonRpcProvider(CAPI_CONFIG.RPC_URL);
    }
    if (window.CAPI_WALLET?.getProvider()) {
      return window.CAPI_WALLET.getProvider();
    }
    return ethers.getDefaultProvider();
  }

  function setSwapLinks() {
    const out = CAPI_CONFIG.TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";
    $("#uEth")  && ($("#uEth").href  = uniswapUrl(CAPI_CONFIG.TOKENS.ETH,  out));
    $("#uUsdc") && ($("#uUsdc").href = uniswapUrl(CAPI_CONFIG.TOKENS.USDC, out));
    $("#uUsdt") && ($("#uUsdt").href = uniswapUrl(CAPI_CONFIG.TOKENS.USDT, out));
    $("#uDai")  && ($("#uDai").href  = uniswapUrl(CAPI_CONFIG.TOKENS.DAI,  out));
  }

  async function fetchPairInfo(pairAddr, preferStable = false) {
    try {
      const { ethers } = window;
      const pair = new ethers.Contract(pairAddr, PAIR_ABI, readProvider);
      const [t0, t1, res] = await Promise.all([pair.token0(), pair.token1(), pair.getReserves()]);
      const token0 = t0.toLowerCase();
      const token1 = t1.toLowerCase();

      const USDC = CAPI_CONFIG.TOKENS.USDC.toLowerCase();
      const WETH = CAPI_CONFIG.TOKENS.WETH.toLowerCase();
      const CAPI = (CAPI_CONFIG.TOKEN_ADDRESS || "").toLowerCase();

      // Identificar orden CAPI/otro
      let capiReserve, otherReserve, otherType = "";
      if (token0 === CAPI) { capiReserve = res._reserve0; otherReserve = res._reserve1; otherType = token1; }
      else if (token1 === CAPI) { capiReserve = res._reserve1; otherReserve = res._reserve0; otherType = token0; }
      else return null;

      // Decimales asumidos: CAPI 8, USDC 6, WETH 18 (esto se puede mejorar con llamadas a ERC20, pero sirve para estimar rápido)
      let priceUSD = null;
      let liquidityUSD = null;

      if (otherType === USDC) {
        const capi = Number(capiReserve) / 1e8;
        const usdc = Number(otherReserve) / 1e6;
        priceUSD = usdc / capi;           // USD/CAPI
        liquidityUSD = usdc * 2;          // aprox (ambos lados)
      } else if (otherType === WETH) {
        const capi = Number(capiReserve) / 1e8;
        const weth = Number(otherReserve) / 1e18;
        const ETH_USD = 3000;             // placeholder; mejor inyectar un precio real si quieres más precisión
        const priceETH = weth / capi;
        priceUSD = priceETH * ETH_USD;
        liquidityUSD = (weth * ETH_USD) * 2;
      } else {
        return null;
      }

      return { priceUSD, liquidityUSD };
    } catch (e) {
      console.warn("pair fetch error", e);
      return null;
    }
  }

  async function loadMarket() {
    try {
      setSwapLinks();

      // Inicializa provider lectura
      readProvider = await getReadProvider();

      const els = {
        priceUsd: $("#priceUsd"),
        mcUsd: $("#mcUsd"),
        liqUsdc: $("#liqUsdc"),
        liqWeth: $("#liqWeth"),
        circ: $("#circ") // de tu página Pro, si está; si no, MC se calcula solo con DEMO
      };

      // DEMO si no hay pares o config
      const demo = CAPI_CONFIG.DEMO || !CAPI_CONFIG.UNISWAP_V2_PAIRS.CAPI_USDC && !CAPI_CONFIG.UNISWAP_V2_PAIRS.CAPI_WETH;

      if (demo) {
        const demoPrice = 0.0000025; // USD
        const demoCirc  = 12_500_000_000; // 12.5B (aprox, para demo)
        els.priceUsd && (els.priceUsd.textContent = `$${fmt(demoPrice, 8)}`);
        els.mcUsd   && (els.mcUsd.textContent    = `$${fmt(demoPrice * demoCirc, 0)}`);
        $("#liqUsdc") && ($("#liqUsdc").textContent = `$${fmt(250_000,0)}`);
        $("#liqWeth") && ($("#liqWeth").textContent = `$${fmt(180_000,0)}`);
        return;
      }

      // Preferimos precio del par con USDC; si no existe, usamos WETH
      let price = null, liqUsdc = null, liqWeth = null;

      if (CAPI_CONFIG.UNISWAP_V2_PAIRS.CAPI_USDC) {
        const info = await fetchPairInfo(CAPI_CONFIG.UNISWAP_V2_PAIRS.CAPI_USDC, true);
        if (info) { price = info.priceUSD; liqUsdc = info.liquidityUSD; }
      }
      if (CAPI_CONFIG.UNISWAP_V2_PAIRS.CAPI_WETH) {
        const info = await fetchPairInfo(CAPI_CONFIG.UNISWAP_V2_PAIRS.CAPI_WETH, false);
        if (info) { if (!price) price = info.priceUSD; liqWeth = info.liquidityUSD; }
      }

      els.priceUsd && (els.priceUsd.textContent = price ? `$${fmt(price, 8)}` : "—");

      // MC: si tienes #circ en tu página, úsalo; si no, puedes definir un circ demo aquí
      const circText = els.circ ? els.circ.textContent.replace(/[^\d.]/g,"") : "";
      const circ = circText ? Number(circText) : 12_500_000_000; // fallback
      els.mcUsd && (els.mcUsd.textContent = price ? `$${fmt(price * circ, 0)}` : "—");

      $("#liqUsdc") && ($("#liqUsdc").textContent = liqUsdc ? `$${fmt(liqUsdc,0)}` : "—");
      $("#liqWeth") && ($("#liqWeth").textContent = liqWeth ? `$${fmt(liqWeth,0)}` : "—");
    } catch (e) {
      console.warn(e);
      $("#priceUsd") && ($("#priceUsd").textContent = "—");
      $("#mcUsd") && ($("#mcUsd").textContent = "—");
      $("#liqUsdc") && ($("#liqUsdc").textContent = "—");
      $("#liqWeth") && ($("#liqWeth").textContent = "—");
    }
  }

  // Init al cargar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadMarket);
  } else {
    loadMarket();
  }
})();

