console.log("[MarketEngine] boot");

const PAIR = window.CAPI_CONFIG.DEX_PAIR_ADDRESS;

async function initMarket() {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/ethereum/${PAIR}`);
  const j = await r.json();

  document.getElementById("launch-panel").innerHTML += `
    <h2>Market Engine Online</h2>
    <p>Price: $${j.pair.priceUsd}</p>
    <p>Liquidity: $${j.pair.liquidity.usd}</p>
    <p>FDV: $${j.pair.fdv}</p>
    <p>24h Volume: $${j.pair.volume.h24}</p>
  `;
}

initMarket();
