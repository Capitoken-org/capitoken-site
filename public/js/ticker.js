(function () {
  const TICKER_ID = "ticker";
  const CLOCK_ID = "ticker-clock";
  const REFRESH_MS = 60000;
  const CLOCK_MS = 1000;

  const el = document.getElementById(TICKER_ID);
  if (!el) return;

  const clockEl = document.getElementById(CLOCK_ID);

  // Top 5 (stable majors) + CAPI placeholder
  const COINS = [
    { id: "bitcoin", symbol: "BTC" },
    { id: "ethereum", symbol: "ETH" },
    { id: "solana", symbol: "SOL" },
    { id: "binancecoin", symbol: "BNB" },
    { id: "ripple", symbol: "XRP" },
    { id: null, symbol: "CAPI" },
  ];

  // Optional: set when you want live CAPI price from DexScreener
  const CAPI_TOKEN_ADDRESS = ""; // e.g. "0x...." (leave empty for —)

  function formatPrice(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    const num = Number(n);
    const opts = num < 10
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { minimumFractionDigits: 0, maximumFractionDigits: 0 };
    return num.toLocaleString(undefined, opts);
  }

  function render(items) {
    el.innerHTML = "";
    items.forEach((it, idx) => {
      const span = document.createElement("span");
      span.className = idx % 2 === 0 ? "ticker__item" : "ticker__item ticker__item--alt";
      span.textContent = `${it.symbol} ${formatPrice(it.price)}`;
      el.appendChild(span);

      if (idx < items.length - 1) {
        const sep = document.createElement("span");
        sep.className = "ticker__sep";
        sep.textContent = " | ";
        el.appendChild(sep);
      }
    });
  }

  async function fetchCoinGecko(ids) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=usd`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("CoinGecko fetch failed");
    return res.json();
  }

  async function fetchDexScreenerPrice(address) {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("DexScreener fetch failed");
    const data = await res.json();
    const p = data?.pairs?.[0]?.priceUsd;
    return p ? Number(p) : null;
  }

  async function tick() {
    // Always render something (prevents "stuck loading" feeling)
    const base = COINS.map((c) => ({ symbol: c.symbol, price: null }));
    render(base);

    try {
      const ids = COINS.filter((c) => c.id).map((c) => c.id);
      const data = await fetchCoinGecko(ids);

      const filled = COINS.map((c) => {
        if (c.id) return { symbol: c.symbol, price: data?.[c.id]?.usd ?? null };
        return { symbol: c.symbol, price: null };
      });

      if (CAPI_TOKEN_ADDRESS) {
        const capiPrice = await fetchDexScreenerPrice(CAPI_TOKEN_ADDRESS);
        const i = filled.findIndex((x) => x.symbol === "CAPI");
        if (i >= 0) filled[i].price = capiPrice;
      }

      render(filled);
    } catch (e) {
      // Keep placeholders; do not break layout
      // Optional: console.debug(e);
    }
  }

  function startClock() {
    if (!clockEl) return;
    const update = () => {
      const d = new Date();
      clockEl.textContent = d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    };
    update();
    setInterval(update, CLOCK_MS);
  }

  startClock();
  tick();
  setInterval(tick, REFRESH_MS);
})();
