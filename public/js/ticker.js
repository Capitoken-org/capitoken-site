(function () {
  const el = document.getElementById("ticker");
  if (!el) return;

  const clone = document.querySelector(".ticker--clone");

  const REFRESH_MS = 60000;

  const coins = [
    { id: "bitcoin", symbol: "BTC" },
    { id: "ethereum", symbol: "ETH" },
    { id: "solana", symbol: "SOL" },
    { id: "binancecoin", symbol: "BNB" },
    { id: "ripple", symbol: "XRP" },
  ];

  const capi = { symbol: "CAPI", price: null };

  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return "USD —";
    return `USD ${Number(n).toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  async function fetchTop() {
    const ids = coins.map((c) => c.id).join(",");
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json();
    return coins.map((c) => ({ symbol: c.symbol, price: j?.[c.id]?.usd ?? null }));
  }

  function build(items) {
    const frag = document.createDocumentFragment();
    items.forEach((it, idx) => {
      const span = document.createElement("span");
      span.className = idx % 2 === 0 ? "ticker__item" : "ticker__item ticker__item--alt";
      span.textContent = `${it.symbol} = ${fmt(it.price)}`;
      frag.appendChild(span);

      if (idx < items.length - 1) {
        const sep = document.createElement("span");
        sep.className = "ticker__sep";
        sep.textContent = "  |  ";
        frag.appendChild(sep);
      }
    });
    return frag;
  }

  function render(items) {
    el.innerHTML = "";
    el.appendChild(build(items));
    if (clone) {
      clone.innerHTML = "";
      clone.appendChild(build(items));
    }
  }

  async function tick() {
    try {
      const top = await fetchTop();
      render([...top, capi]);
    } catch {
      // keep last good values
    }
  }

  // Clock (top-right, above ticker)
  const clock = document.getElementById("navClock");
  if (clock) {
    const paint = () => (clock.textContent = new Date().toLocaleString("es-ES"));
    paint();
    setInterval(paint, 1000);
  }

  tick();
  setInterval(tick, REFRESH_MS);
})();
