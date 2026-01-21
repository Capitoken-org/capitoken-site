// public/js/ticker.js
// Live prices ticker + local time (no dependencies).
// Format: BTC = USD 89.898,00  |  ETH = USD 2.989,27  | ...

(function () {
  const TICKER_ID = "ticker";
  const REFRESH_MS = 60_000;
  const CLOCK_MS = 1_000;

  const el = document.getElementById(TICKER_ID);
  if (!el) return;

  const clone = document.querySelector(".ticker__track--clone");
  const clockEl = document.getElementById("navClock");

  const coins = [
    { id: "bitcoin", symbol: "BTC" },
    { id: "ethereum", symbol: "ETH" },
    { id: "solana", symbol: "SOL" },
    { id: "binancecoin", symbol: "BNB" },
    { id: "ripple", symbol: "XRP" },
  ];

  function formatUsd(n) {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    // Desired look: 89.898,00 (thousands dot, decimals comma)
    const s = n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `USD ${s}`;
  }

  function makeItemText(symbol, usdValue) {
    return `${symbol} = ${formatUsd(usdValue)}`;
  }

  function render(items) {
    el.innerHTML = "";
    items.forEach((it, idx) => {
      const span = document.createElement("span");
      span.className = "ticker__item " + (idx % 2 === 1 ? "ticker__item--alt" : "");
      span.textContent = makeItemText(it.symbol, it.usd);
      el.appendChild(span);

      if (idx < items.length - 1) {
        const sep = document.createElement("span");
        sep.className = "ticker__sep";
        sep.textContent = "|";
        el.appendChild(sep);
      }
    });

    if (clone) clone.innerHTML = el.innerHTML;
  }

  async function fetchPrices() {
    const ids = coins.map((c) => c.id).join(",");
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("Price fetch failed");
    const j = await r.json();
    return coins.map((c) => ({ symbol: c.symbol, usd: j?.[c.id]?.usd ?? NaN }));
  }

  function getCapiUsd() {
    // If other site scripts publish a live CAPI price, we can show it.
    // Supported shapes (optional):
    // - window.CAPI_MARKET.priceUsd
    // - window.__CAPI_PRICE_USD
    const v =
      (typeof window !== "undefined" && window.CAPI_MARKET && window.CAPI_MARKET.priceUsd) ||
      (typeof window !== "undefined" && window.__CAPI_PRICE_USD);
    const n = Number(v);
    return isFinite(n) ? n : NaN;
  }

  async function updateTicker() {
    try {
      const top = await fetchPrices();
      const capiUsd = getCapiUsd();
      const items = [...top, { symbol: "CAPI", usd: capiUsd }];
      render(items);
    } catch (e) {
      el.textContent = "Loading prices…";
      if (clone) clone.textContent = "";
      // Keep silent (no console noise in production)
    }
  }

  function updateClock() {
    if (!clockEl) return;
    const d = new Date();
    // Example: 21/1/2026, 15:53:28 (user locale)
    const date = d.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
    const time = d.toLocaleTimeString(undefined, { hour12: false });
    clockEl.textContent = `${date}, ${time}`;
  }

  updateTicker();
  updateClock();
  setInterval(updateTicker, REFRESH_MS);
  setInterval(updateClock, CLOCK_MS);
})();
