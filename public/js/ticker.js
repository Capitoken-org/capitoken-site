(function () {
  const el = document.getElementById("ticker");
  if (!el) return;

  const track = document.querySelector(".tickerbar__track");
  const viewport = document.querySelector(".tickerbar__viewport");
  const clone = document.querySelector(".ticker--clone");
  const clock = document.getElementById("navClock");

  const REFRESH_MS = 60000;
  const COIN_LIMIT = 10;

  const capi = { symbol: "CAPI", price: null };

  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return "USD —";
    return `USD ${Number(n).toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  async function fetchTop() {
    // Pull top coins by market cap directly (keeps the list current without hardcoding IDs).
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${COIN_LIMIT}&page=1&sparkline=false&price_change_percentage=24h`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("coingecko markets failed");
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error("coingecko markets shape invalid");
    return j
      .slice(0, COIN_LIMIT)
      .map((c) => ({
        symbol: String(c?.symbol || "").toUpperCase(),
        price: c?.current_price ?? null,
        change24h: c?.price_change_percentage_24h ?? null,
      }));
  }

  function build(items) {
    const frag = document.createDocumentFragment();
    items.forEach((it, idx) => {
      const span = document.createElement("span");
      const isCapi = (it.symbol || '').toUpperCase() === 'CAPI';
      span.className = isCapi
        ? 'ticker__item ticker__item--capi'
        : (idx % 2 === 0 ? 'ticker__item' : 'ticker__item ticker__item--alt');
      const ch = (it && typeof it.change24h === "number" && isFinite(it.change24h))
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
    // start exactly at the right edge of the marquee viewport
    const start = viewport.clientWidth;
    const gap = 28;

    // width of a single run (el + separators)
    const single = el.scrollWidth;
    const end = -(single + gap);

    track.style.setProperty("--marquee-start", `${start}px`);
    track.style.setProperty("--marquee-end", `${end}px`);

    // restart animation reliably
    track.classList.remove("is-animating");
    // force reflow
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
      const top = await fetchTop();
      render([...top, capi]);
    } catch {
      // keep last values
      setMarquee();
    }
  }

  // Local clock
  if (clock) {
    const pad2 = (n) => String(n).padStart(2, "0");
    const tzFmt = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" });
    const dowFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
    const monFmt = new Intl.DateTimeFormat(undefined, { month: "short" });

    const paint = () => {
      const d = new Date();
      const h = pad2(d.getHours());
      const m = pad2(d.getMinutes());
      const s = pad2(d.getSeconds());

      // Example: "Wed • Jan 21" and timezone suffix "GMT-6" (varies by user locale).
      const dow = dowFmt.format(d);
      const mon = monFmt.format(d);
      const day = d.getDate();
      const tz = (tzFmt.formatToParts(d).find((p) => p.type === "timeZoneName")?.value) || "";

      clock.innerHTML = `
        <div class="clock__time">${h}:${m}<span class="clock__sec">:${s}</span></div>
        <div class="clock__date">${dow} • ${mon} ${day}<span class="clock__tz"> • ${tz}</span></div>
      `.trim();
    };

    paint();
    setInterval(paint, 1000);
  }

  tick();
  setInterval(tick, REFRESH_MS);
  window.addEventListener("resize", () => setMarquee());
})();
