(function () {
  const TICKER_ID = "ticker";
  const REFRESH_MS = 60000;
  const CLOCK_MS = 1000;

  const el = document.getElementById(TICKER_ID);
  if (!el) return;

  // Optional clone for seamless marquee
  const clone = document.querySelector(".ticker--clone");

  const coins = [
    { id: "bitcoin", symbol: "BTC" },
    { id: "ethereum", symbol: "ETH" },
    { id: "solana", symbol: "SOL" },
    { id: "binancecoin", symbol: "BNB" },
    { id: "ripple", symbol: "XRP" },
  ];

  const capi = { symbol: "CAPI" };

  function formatUsd(n) {
    if (n === null || n === undefined || isNaN(n)) return "USD —";
    // Spanish-style formatting: 89.898,00
    const formatted = Number(n).toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `USD ${formatted}`;
  }

  async function fetchTop() {
    const ids = coins.map((c) => c.id).join(",");
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return coins.map((c) => ({
      symbol: c.symbol,
      price: data?.[c.id]?.usd ?? null,
    }));
  }

  async function fetchCAPI() {
    // Replace TOKEN_ADDRESS when available for live price via DexScreener
    const TOKEN_ADDRESS = "";
    if (!TOKEN_ADDRESS) return { symbol: capi.symbol, price: null };

    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      const p = data?.pairs?.[0]?.priceUsd ?? null;
      return { symbol: capi.symbol, price: p ? Number(p) : null };
    } catch {
      return { symbol: capi.symbol, price: null };
    }
  }

  function render(items) {
    el.innerHTML = "";

    items.forEach((it, idx) => {
      const span = document.createElement("span");
      span.className = idx % 2 === 0 ? "ticker__item" : "ticker__item ticker__item--alt";
      span.textContent = `${it.symbol} = ${formatUsd(it.price)}`;
      el.appendChild(span);

      if (idx < items.length - 1) {
        const sep = document.createElement("span");
        sep.className = "ticker__sep";
        sep.textContent = " | ";
        el.appendChild(sep);
      }
    });

    // Mirror into clone (seamless loop)
    if (clone) clone.innerHTML = el.innerHTML;
  }

  async function tick() {
    try {
      const top = await fetchTop();
      const c = await fetchCAPI();
      render([...top, c]);
    } catch {
      // Keep existing UI; don't hard-fail.
    }
  }

  // Clock
  const clock = document.getElementById("ticker-clock");
  if (clock) {
    const paint = () => {
      const d = new Date();
      clock.textContent = d.toLocaleString();
    };
    paint();
    setInterval(paint, CLOCK_MS);
  }

  tick();
  setInterval(tick, REFRESH_MS);
})();
