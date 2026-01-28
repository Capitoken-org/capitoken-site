/* Capitoken — Pulse Snapshot (DexScreener + optional Etherscan) 
   - Renders a compact "Community Snapshot" inside the CAPI Pulse card
   - Uses localStorage snapshots to compute 24h deltas and draw a small 7d liquidity trend sparkline
*/
(function () {
  const PULSE_VERSION = "v1.2"; // cache-busting verification

  const CFG_WAIT_MS = 3200;
  const CFG_POLL_MS = 80;

  const el = (id) => document.getElementById(id);

  function fmtUSD(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    const num = Number(n);
    if (!Number.isFinite(num)) return "—";
    if (num >= 1e9) return `$${(num/1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num/1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num/1e3).toFixed(2)}K`;
    if (num >= 1) return `$${num.toFixed(2)}`;
    // for very small prices/liquidity deltas
    return `$${num.toPrecision(6)}`;
  }

  function fmtInt(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    const num = Number(n);
    if (!Number.isFinite(num)) return "—";
    return Math.round(num).toString();
  }

  function setDeltaBadge(node, delta) {
    if (!node) return;
    if (delta === null || delta === undefined || Number.isNaN(delta)) {
      node.textContent = "—";
      node.classList.remove("delta--up","delta--down");
      node.classList.add("delta--flat");
      return;
    }
    const d = Number(delta);
    node.classList.remove("delta--up","delta--down","delta--flat");
    if (d > 0) {
      node.classList.add("delta--up");
      node.textContent = `↑ +${fmtInt(d)}`;
    } else if (d < 0) {
      node.classList.add("delta--down");
      node.textContent = `↓ ${fmtInt(d)}`;
    } else {
      node.classList.add("delta--flat");
      node.textContent = "↔ 0";
    }
  }

  function formatAge(tsMs) {
    if (!tsMs) return "—";
    const days = (Date.now() - tsMs) / (1000 * 60 * 60 * 24);
    if (!Number.isFinite(days) || days < 0) return "—";

    if (days < 30) {
      const d = Math.max(0, Math.floor(days));
      return `${d} ${d === 1 ? "Day" : "Days"}`;
    }
    if (days < 365) {
      const mo = Math.max(1, Math.floor(days / 30));
      return `${mo} ${mo === 1 ? "Month" : "Months"}`;
    }
    const yr = Math.max(1, Math.floor(days / 365));
    return `${yr} ${yr === 1 ? "Year" : "Years"}`;
  }


  function readSnapshots() {
    try {
      const raw = localStorage.getItem("capi_pulse_snapshots_v1");
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function writeSnapshots(arr) {
    try {
      localStorage.setItem("capi_pulse_snapshots_v1", JSON.stringify(arr));
    } catch {}
  }

  function pruneSnapshots(arr) {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - weekMs;
    return arr.filter(p => p && typeof p.t === "number" && p.t >= cutoff).slice(-120);
  }
  // Baseline ("since launch" per-browser): first valid price we ever observe.
  // This is local to each visitor (localStorage) to avoid maintaining a global baseline.
  const BASELINE_KEY = "capi_pulse_baseline_price_v1";
  const BASELINE_TS_KEY = "capi_pulse_baseline_ts_v1";

  function getBaseline() {
    try {
      const p = Number(localStorage.getItem(BASELINE_KEY));
      const t = Number(localStorage.getItem(BASELINE_TS_KEY));
      return (Number.isFinite(p) && p > 0) ? { p, t: Number.isFinite(t) ? t : null } : null;
    } catch {
      return null;
    }
  }

  function setBaseline(price) {
    try {
      localStorage.setItem(BASELINE_KEY, String(price));
      localStorage.setItem(BASELINE_TS_KEY, String(Date.now()));
    } catch {}
  }

  function pctChange(now, base) {
    if (!Number.isFinite(now) || !Number.isFinite(base) || base <= 0) return null;
    return ((now - base) / base) * 100;
  }

  function fmtPct(p) {
    if (p === null || p === undefined || !Number.isFinite(p)) return "—";
    const sign = p > 0 ? "+" : "";
    const abs = Math.abs(p);
    if (abs >= 100) return `${sign}${p.toFixed(0)}%`;
    if (abs >= 10) return `${sign}${p.toFixed(1)}%`;
    return `${sign}${p.toFixed(2)}%`;
  }



  function findSnapshotNear(arr, targetMs, windowMs) {
    // Find latest snapshot with time within [target-window, target+window]
    const min = targetMs - windowMs;
    const max = targetMs + windowMs;
    let candidate = null;
    for (const p of arr) {
      if (!p || typeof p.t !== "number") continue;
      if (p.t >= min && p.t <= max) candidate = p;
    }
    return candidate;
  }

  function renderSparkline(values) {
    const svg = el("pulseLiqChart");
    const area = el("pulseLiqArea");
    const line = el("pulseLiqLine");
    if (!svg || !area || !line) return;

    const w = 300, h = 60;
    const pad = 3;

    if (!values || values.length < 2) {
      // Flat line placeholder
      const y = Math.round(h * 0.65);
      const dLine = `M ${pad} ${y} L ${w - pad} ${y}`;
      line.setAttribute("d", dLine);
      area.setAttribute("d", `M ${pad} ${h-pad} L ${pad} ${y} L ${w-pad} ${y} L ${w-pad} ${h-pad} Z`);
      return;
    }

    const nums = values.map(v => Number(v)).filter(v => Number.isFinite(v));
    if (nums.length < 2) return;

    const minV = Math.min(...nums);
    const maxV = Math.max(...nums);
    const span = (maxV - minV) || 1;

    const step = (w - pad*2) / (nums.length - 1);

    const pts = nums.map((v, i) => {
      const x = pad + i * step;
      const norm = (v - minV) / span;
      const y = pad + (1 - norm) * (h - pad*2);
      return [x, y];
    });

    const d = pts.map((p, i) => (i === 0 ? `M ${p[0].toFixed(2)} ${p[1].toFixed(2)}` : `L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`)).join(" ");
    line.setAttribute("d", d);

    const dArea = `${d} L ${(w-pad).toFixed(2)} ${(h-pad).toFixed(2)} L ${pad.toFixed(2)} ${(h-pad).toFixed(2)} Z`;
    area.setAttribute("d", dArea);
  }

  async function fetchDexPair(chain, pairAddress) {
    const url = `https://api.dexscreener.com/latest/dex/pairs/${encodeURIComponent(chain)}/${encodeURIComponent(pairAddress)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`);
    const data = await res.json();
    // DexScreener returns {pair:{...}} or {pairs:[...]} depending on endpoint changes; handle both.
    return data.pair || (Array.isArray(data.pairs) ? data.pairs[0] : null);
  }

  async function fetchHoldersEtherscan(contract, apiKey) {
    if (!contract || !apiKey) return null;
    const url = `https://api.etherscan.io/api?module=token&action=tokenholdercount&contractaddress=${encodeURIComponent(contract)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && (data.status === "1" || data.message === "OK") && data.result) {
      const n = Number(data.result);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  function applyValues(pair, holders, cfg) {
    // Stage label
    const stage = el("pulseStage");
    if (stage) stage.textContent = cfg.PULSE_STAGE_LABEL || "Live (Early)";

    // Dex values
    const priceUsd = pair && pair.priceUsd ? Number(pair.priceUsd) : null;
    const liqUsd = pair && pair.liquidity && pair.liquidity.usd ? Number(pair.liquidity.usd) : null;
    const vol24 = pair && pair.volume && pair.volume.h24 ? Number(pair.volume.h24) : null;

    const buys = pair && pair.txns && pair.txns.h24 && typeof pair.txns.h24.buys === "number" ? pair.txns.h24.buys : null;
    const sells = pair && pair.txns && pair.txns.h24 && typeof pair.txns.h24.sells === "number" ? pair.txns.h24.sells : null;
    const active = (buys !== null && sells !== null) ? (buys + sells) : null;

    const createdAt = pair && pair.pairCreatedAt ? Number(pair.pairCreatedAt) : null;

    // Market cap (prefer marketCap then fdv if present)
    const mcap = pair && (pair.marketCap || pair.fdv) ? Number(pair.marketCap || pair.fdv) : null;

    // Update DOM
    const mPrice = el("mPrice"); if (mPrice) mPrice.textContent = (priceUsd !== null ? fmtUSD(priceUsd) : "TBA");

    // Since-launch % (per-browser baseline). If there is an extra tile (#pulseSince) we fill it,
    // otherwise we append the percent next to the price to avoid changing HTML.
    if (priceUsd !== null && Number.isFinite(priceUsd)) {
      const base = getBaseline();
      if (!base) setBaseline(priceUsd);
      const base2 = base || { p: priceUsd };
      const pchg = pctChange(priceUsd, base2.p);
      const sinceEl = el("pulseSince");
      if (sinceEl) sinceEl.textContent = fmtPct(pchg);
      if (!sinceEl && mPrice && pchg !== null) mPrice.textContent = `${fmtUSD(priceUsd)} (${fmtPct(pchg)})`;
    }

    const mLiq = el("mLiq"); if (mLiq) mLiq.textContent = (liqUsd !== null ? fmtUSD(liqUsd) : "TBA");
    const mVol = el("mVol"); if (mVol) mVol.textContent = (vol24 !== null ? fmtUSD(vol24) : "TBA");
    const mMcap = el("mMcap"); if (mMcap) mMcap.textContent = (mcap !== null ? fmtUSD(mcap) : "TBA");
    const bs = el("pulseBS"); if (bs) bs.textContent = (buys !== null && sells !== null) ? `${buys} / ${sells}` : "—";
    const age = el("pulseAge"); if (age) age.textContent = formatAge(createdAt);

    const hEl = el("pulseHolders"); if (hEl) hEl.textContent = holders !== null ? fmtInt(holders) : "—";
    const aEl = el("pulseActive"); if (aEl) aEl.textContent = active !== null ? fmtInt(active) : "—";

    // Snapshots + deltas + chart
    let snaps = readSnapshots();
    const now = Date.now();
    snaps = pruneSnapshots(snaps);

    // Append snapshot only if value exists and last snapshot is old enough (>= 20 min) to avoid spam.
    const last = snaps.length ? snaps[snaps.length - 1] : null;
    const tooSoon = last && typeof last.t === "number" && (now - last.t) < (20 * 60 * 1000);

    const snap = {
      t: now,
      liq: Number.isFinite(liqUsd) ? liqUsd : null,
      holders: Number.isFinite(holders) ? holders : null
    };

    if (!tooSoon) {
      snaps.push(snap);
      snaps = pruneSnapshots(snaps);
      writeSnapshots(snaps);
    }

    const snap24 = findSnapshotNear(snaps, now - (24 * 60 * 60 * 1000), 6 * 60 * 60 * 1000); // ±6h window
    const dH = (snap24 && Number.isFinite(snap.holders) && Number.isFinite(snap24.holders)) ? (snap.holders - snap24.holders) : null;
    const dL = (snap24 && Number.isFinite(snap.liq) && Number.isFinite(snap24.liq)) ? (snap.liq - snap24.liq) : null;

    setDeltaBadge(el("pulseHoldersDelta"), dH);
    // Liquidity delta badge shows $ diff, not integer
    const liqDeltaNode = el("pulseLiqDelta");
    if (liqDeltaNode) {
      if (dL === null) {
        liqDeltaNode.textContent = "—";
        liqDeltaNode.classList.remove("delta--up","delta--down");
        liqDeltaNode.classList.add("delta--flat");
      } else if (dL > 0) {
        liqDeltaNode.classList.remove("delta--down","delta--flat");
        liqDeltaNode.classList.add("delta--up");
        liqDeltaNode.textContent = `↑ +${fmtUSD(dL)}`;
      } else if (dL < 0) {
        liqDeltaNode.classList.remove("delta--up","delta--flat");
        liqDeltaNode.classList.add("delta--down");
        liqDeltaNode.textContent = `↓ ${fmtUSD(Math.abs(dL))}`;
      } else {
        liqDeltaNode.classList.remove("delta--up","delta--down");
        liqDeltaNode.classList.add("delta--flat");
        liqDeltaNode.textContent = "↔ $0";
      }
    }

    // Render sparkline from liquidity history
    const liqSeries = snaps.map(p => p && Number.isFinite(p.liq) ? p.liq : null).filter(v => v !== null);
    renderSparkline(liqSeries);
  }

  async 
  function updatePulseNote({ chain, pair, contract }) {
    const selectors = ["#pulseNote", "#capiPulseNote", ".pulse-note", "[data-pulse-note]"];
    let node = null;
    for (const sel of selectors) {
      const n = document.querySelector(sel);
      if (n) { node = n; break; }
    }
    if (!node) return;

    const dexUrl = pair ? `https://dexscreener.com/${encodeURIComponent(chain)}/${encodeURIComponent(pair)}` : `https://dexscreener.com/${encodeURIComponent(chain)}`;
    const esUrl = contract ? `https://etherscan.io/token/${encodeURIComponent(contract)}` : "https://etherscan.io/";

    node.innerHTML = `Early community stage. Low activity can be normal. If it’s not listed here, it’s not official. ` +
      `<span class="pulse-sources">Sources: <a href="${dexUrl}" target="_blank" rel="noopener noreferrer">DexScreener</a> &amp; ` +
      `<a href="${esUrl}" target="_blank" rel="noopener noreferrer">Etherscan</a>.</span>`;
  }

async function run(cfg) {
    const chain = (cfg.DEXSCREENER_CHAIN || "ethereum").toLowerCase();
    const pair = cfg.DEX_PAIR_ADDRESS || "";
    const contract = cfg.CONTRACT_ADDRESS || "";
    const apiKey = cfg.ETHERSCAN_API_KEY || "";

    if (!pair) return;

    try {
      const dexPair = await fetchDexPair(chain, pair);
      const holders = await fetchHoldersEtherscan(contract, apiKey);
      applyValues(dexPair, holders, cfg);
      updatePulseNote({ chain, pair, contract });
    } catch (e) {
      updatePulseNote({ chain, pair, contract });
      // Keep placeholders; do not crash the page
      console.warn("[CAPI Pulse] failed:", e);
      // Still try to draw chart from existing snapshots, if any
      const snaps = pruneSnapshots(readSnapshots());
      const liqSeries = snaps.map(p => p && Number.isFinite(p.liq) ? p.liq : null).filter(v => v !== null);
      renderSparkline(liqSeries);
    }
  }

  function waitForConfig() {
    const start = Date.now();
    const timer = setInterval(() => {
      const cfg = window.CAPI_CONFIG || window.__CAPI_CONFIG__ || null;
      if (cfg) {
        clearInterval(timer);
        run(cfg);
      } else if (Date.now() - start > CFG_WAIT_MS) {
        clearInterval(timer);
        // No config; nothing to do.
      }
    }, CFG_POLL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForConfig);
  } else {
    waitForConfig();
  }
})();
