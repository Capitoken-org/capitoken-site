(function () {
  const el = document.getElementById("ticker");
  if (!el) return;

  const track = document.querySelector(".tickerbar__track");
  const viewport = document.querySelector(".tickerbar__viewport");
  const clone = document.querySelector(".ticker--clone");
  const clock = document.getElementById("navClock");

  const REFRESH_MS = 60000;

  // Fixed order (user-approved): BTC / ETH / BNB / XRP / SOL / TRX / ADA / BCH / XMR / LINK + CAPI
  const FIXED = [
    { id: "bitcoin", symbol: "BTC" },
    { id: "ethereum", symbol: "ETH" },
    { id: "binancecoin", symbol: "BNB" },
    { id: "ripple", symbol: "XRP" },
    { id: "solana", symbol: "SOL" },
    { id: "tron", symbol: "TRX" },
    { id: "cardano", symbol: "ADA" },
    { id: "bitcoin-cash", symbol: "BCH" },
    { id: "monero", symbol: "XMR" },
    { id: "chainlink", symbol: "LINK" },
  ];

  // CAPI keeps its special styling (★) and can stay as placeholder until you wire live pricing
  const capi = { symbol: "CAPI", price: null, change24h: null };

  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return "USD —";
    return `USD ${Number(n).toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  async function fetchFixed() {
    const ids = FIXED.map((c) => c.id).join(",");
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      ids
    )}&vs_currencies=usd&include_24hr_change=true`;

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("coingecko simple price failed");
    const j = await r.json();
    if (!j || typeof j !== "object")
      throw new Error("coingecko simple price shape invalid");

    return FIXED.map((c) => {
      const row = j[c.id] || {};
      return {
        symbol: c.symbol,
        price: typeof row.usd === "number" ? row.usd : null,
        change24h:
          typeof row.usd_24h_change === "number" ? row.usd_24h_change : null,
      };
    });
  }

  function build(items) {
    const frag = document.createDocumentFragment();
    items.forEach((it, idx) => {
      const span = document.createElement("span");
      const isCapi = (it.symbol || "").toUpperCase() === "CAPI";
      span.className = isCapi
        ? "ticker__item ticker__item--capi"
        : idx % 2 === 0
        ? "ticker__item"
        : "ticker__item ticker__item--alt";

      const ch =
        it && typeof it.change24h === "number" && isFinite(it.change24h)
          ? `${it.change24h >= 0 ? "+" : ""}${it.change24h.toFixed(2)}%`
          : null;

      span.textContent = isCapi
        ? `★ ${it.symbol} = ${fmt(it.price)}`
        : `${it.symbol} = ${fmt(it.price)}${ch ? ` (${ch})` : ""}`;

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

  function setMarquee() {
    if (!track || !viewport) return;
    const start = 0;
    const gap = 28;

    const single = el.scrollWidth;
    const end = -(single + gap);

    track.style.setProperty("--marquee-start", `${start}px`);
    track.style.setProperty("--marquee-end", `${end}px`);

    track.classList.remove("is-animating");
    void track.offsetWidth;
    track.classList.add("is-animating");
  }

  function render(items) {
    el.innerHTML = "";
    el.appendChild(build(items));

    if (clone) {
      clone.innerHTML = "";
      clone.appendChild(build(items));
      clone.style.paddingLeft = "28px";
    }

    setMarquee();
  }

  async function tick() {
    try {
      const fixed = await fetchFixed();
      render([...fixed, capi]);
    } catch {
      // keep last values
      setMarquee();
    }
  }

  // Local clock (kept as-is)
  if (clock) {
    const fmtTime = () => {
      try {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        clock.textContent = `${hh}:${mm}:${ss}`;
      } catch {}
    };
    fmtTime();
    setInterval(fmtTime, 1000);
  }

  tick();
  setInterval(tick, REFRESH_MS);
})();
