// Capitoken — Live Market Ticker (Top 5 + CAPI) + Local Time
// Runs client-side. Safe for static Astro/GitHub Pages.

const TRACK_ID = "capiTickerTrack";
const TIME_ID = "capiTickerTime";

// If capi-config.js exposes a token address, use it; otherwise fallback to mainnet address.
const FALLBACK_CAPI_TOKEN = "0xF2dA6C9B945c688A52D3B72340E622014920de6a";
const getCapiTokenAddress = () => {
  const fromConfig =
    (globalThis.CAPI_CONFIG && (globalThis.CAPI_CONFIG.TOKEN_ADDRESS || globalThis.CAPI_CONFIG.tokenAddress)) ||
    (globalThis.CAPI && (globalThis.CAPI.TOKEN_ADDRESS || globalThis.CAPI.tokenAddress));
  return (fromConfig && String(fromConfig)) || FALLBACK_CAPI_TOKEN;
};

const fmtUSD = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const num = Number(n);
  // Compact formatting for very small values
  if (num > 0 && num < 0.0001) return num.toExponential(2);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: num < 1 ? 6 : 2,
  }).format(num);
};

const fmtPct = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const num = Number(n);
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
};

async function fetchTopCoins() {
  // CoinGecko: simple price + 24h change
  const ids = ["bitcoin", "ethereum", "solana", "binancecoin", "ripple"];
  const url =
    "https://api.coingecko.com/api/v3/simple/price" +
    `?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("CoinGecko fetch failed");
  const data = await res.json();
  const map = {
    bitcoin: "BTC",
    ethereum: "ETH",
    solana: "SOL",
    binancecoin: "BNB",
    ripple: "XRP",
  };
  return ids.map((id) => ({
    sym: map[id],
    price: data?.[id]?.usd ?? null,
    chg: data?.[id]?.usd_24h_change ?? null,
  }));
}

async function fetchCapiPrice() {
  // DexScreener token endpoint
  const token = getCapiTokenAddress();
  const url = `https://api.dexscreener.com/latest/dex/tokens/${token}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("DexScreener fetch failed");
  const data = await res.json();
  const pair = Array.isArray(data?.pairs) && data.pairs.length ? data.pairs[0] : null;
  return {
    sym: "CAPI",
    price: pair?.priceUsd ? Number(pair.priceUsd) : null,
    chg: pair?.priceChange?.h24 ? Number(pair.priceChange.h24) : null,
  };
}

function buildTickerLine(items) {
  // Example: BTC $45,123 (+1.2%) • ETH ...
  const parts = items.map((it) => {
    const p = fmtUSD(it.price);
    const c = fmtPct(it.chg);
    return `${it.sym} ${p} (${c})`;
  });
  return parts.join("  •  ");
}

function setTrack(text) {
  const el = document.getElementById(TRACK_ID);
  if (!el) return;
  // Duplicate the content for smoother looping
  el.textContent = `${text}   •   ${text}`;
  el.setAttribute("title", text);
}

function startClock() {
  const el = document.getElementById(TIME_ID);
  if (!el) return;
  const tick = () => {
    const now = new Date();
    // Example: Jan 21, 2026 • 09:14:05
    const date = new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(now);
    const time = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(now);
    el.textContent = `${date} • ${time}`;
  };
  tick();
  setInterval(tick, 1000);
}

async function refreshPrices() {
  try {
    const [top, capi] = await Promise.all([fetchTopCoins(), fetchCapiPrice()]);
    const line = buildTickerLine([...top, capi]);
    setTrack(line);
    document.documentElement.classList.add("ticker-ready");
  } catch (e) {
    // Fail gracefully: keep UI stable.
    setTrack("BTC — • ETH — • SOL — • BNB — • XRP — • CAPI —");
  }
}

(function init() {
  startClock();
  refreshPrices();
  // Update prices every 60s (lightweight)
  setInterval(refreshPrices, 60000);
})();
