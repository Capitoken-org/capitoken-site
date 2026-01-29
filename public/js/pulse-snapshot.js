/* Capitoken — Pulse Snapshot (DexScreener + optional Etherscan) 
   - Renders a compact "Community Snapshot" inside the CAPI Pulse card
   - Uses localStorage snapshots to compute 24h deltas and draw a small 7d liquidity trend sparkline
*/
(function () {
  const PULSE_VERSION = "snapshot-v1.4";
  const CFG_WAIT_MS = 3200;
  const CFG_POLL_MS = 80;

  let lastHoldersErr = "";

  const el = (id) => document.getElementById(id);

  const isOwnedByIndex = (node) => !!(node && node.getAttribute && node.getAttribute("data-pulse-owner") === "index");

  function fmtUSD(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    const num = Number(n);
    if (!Number.isFinite(num)) return "—";
    if (num >= 1e9) return `$${(num/1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num/1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num/1e3).toFixed(2)}K`;
    if (num >= 1) return `$${num.toFixed(2)}`;
    // Micro-prices: avoid scientific notation (e.g., 6.17e-7)
    // Keep up to 10 decimals, then trim trailing zeros.
    const fixed = num.toFixed(10);
    const trimmed = fixed.replace(/0+$/,"").replace(/\.$/,"");
    return `$${trimmed}`;
  }

  function fmtInt(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    const num = Number(n);
    if (!Number.isFinite(num)) return "—";
    return Math.round(num).toString();
  }

  // Baseline ("since launch") — stored per-browser. First valid price observed becomes baseline.
  const BASELINE_KEY = "capi_pulse_baseline_price_usd_v1";

  function getBaseline() {
    try {
      const raw = localStorage.getItem(BASELINE_KEY);
      const n = raw ? Number(raw) : null;
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch { return null; }
  }

  function setBaseline(priceUsd) {
    try {
      const n = Number(priceUsd);
      if (!Number.isFinite(n) || n <= 0) return;
      if (getBaseline() === null) localStorage.setItem(BASELINE_KEY, String(n));
    } catch {}
  }

  function pctSinceBaseline(priceUsd) {
    const base = getBaseline();
    const p = Number(priceUsd);
    if (!base || !Number.isFinite(p) || p <= 0) return null;
    return ((p - base) / base) * 100;
  }

  function fmtPct(pct) {
    if (pct === null || pct === undefined || Number.isNaN(pct)) return "—";
    const p = Number(pct);
    if (!Number.isFinite(p)) return "—";
    const abs = Math.abs(p);
    const txt = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
    return (p > 0 ? `+${txt}%` : p < 0 ? `-${txt}%` : `+0.0%`);
  }

  function setPctBadge(node, pct) {
    if (!node) return;
    if (pct === null || pct === undefined || Number.isNaN(pct)) {
      node.textContent = "—";
      node.classList.remove("delta--up","delta--down");
      node.classList.add("delta--flat");
      return;
    }
    const p = Number(pct);
    node.classList.remove("delta--up","delta--down","delta--flat");
    if (p > 0) node.classList.add("delta--up");
    else if (p < 0) node.classList.add("delta--down");
    else node.classList.add("delta--flat");
    node.textContent = fmtPct(p);
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

  function humanAge(tsMs) {
    if (!tsMs) return "—";
    const days = (Date.now() - tsMs) / (1000 * 60 * 60 * 24);
    if (!Number.isFinite(days) || days < 0) return "—";
    const d = Math.floor(days);
    if (d < 30) return `${d} ${d === 1 ? "Day" : "Days"}`;
    const months = Math.floor(d / 30);
    if (d < 365) return `${months} ${months === 1 ? "Month" : "Months"}`;
    const years = Math.floor(d / 365);
    return `${years} ${years === 1 ? "Year" : "Years"}`;
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

  function updatePulseNote({ chain, pair, contract }) {
    const selectors = ["#pulseNote", "#capiPulseNote", ".pulse-note", "[data-pulse-note]"];
    let node = null;
    for (const sel of selectors) {
      const n = document.querySelector(sel);
      if (n) { node = n; break; }
    }
    if (!node) return;

    const safe = (u) => { try { return new URL(u).toString(); } catch { return ""; } };

    const dexUrl = pair ? safe(`https://dexscreener.com/${chain}/${pair}`) : safe(`https://dexscreener.com/${chain}`);
    const ethUrl = contract ? safe(`https://etherscan.io/token/${contract}`) : safe("https://etherscan.io/");

    const html = 
      `Early community stage. Low activity can be normal. If it’s not listed here, it’s not official.` +
      `<br><span class="muted">Sources:</span> ` +
      `<a href="${dexUrl}" target="_blank" rel="noreferrer noopener">DexScreener</a>` +
      ` <span class="muted">and</span> ` +
      `<a href="${ethUrl}" target="_blank" rel="noreferrer noopener">Etherscan</a>.`;

    if (node.innerHTML !== html) node.innerHTML = html
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
    lastHoldersErr = "";
    if (!contract) { lastHoldersErr = "missing contract"; return null; }
    if (!apiKey) { lastHoldersErr = "missing API key"; return null; }

    const url = `https://api.etherscan.io/api?module=token&action=tokenholdercount&contractaddress=${encodeURIComponent(contract)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) { lastHoldersErr = `http ${res.status}`; return null; }
    const data = await res.json();

    // Etherscan returns { status: "1", message: "OK", result: "<number>" } on success
    if (data && (data.status === "1" || data.message === "OK") && data.result) {
      const n = Number(data.result);
      if (Number.isFinite(n)) return n;
      lastHoldersErr = "invalid result";
      return null;
    }

    // Common failure shapes
    if (data && typeof data.result === "string") lastHoldersErr = data.result.slice(0, 80);
    else if (data && data.message) lastHoldersErr = String(data.message).slice(0, 80);
    else lastHoldersErr = "not ok";
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
    const mPrice = el("mPrice");
    if (mPrice) {
      if (priceUsd !== null) {
        setBaseline(priceUsd);
        const pct = pctSinceBaseline(priceUsd);
        mPrice.textContent = fmtUSD(priceUsd) + (pct !== null ? ` (${fmtPct(pct)})` : "");
      } else {
        mPrice.textContent = "TBA";
      }
    }
    const mLiq = el("mLiq"); if (mLiq) mLiq.textContent = (liqUsd !== null ? fmtUSD(liqUsd) : "TBA");
    const mVol = el("mVol"); if (mVol) mVol.textContent = (vol24 !== null ? fmtUSD(vol24) : "TBA");
    const mMcap = el("mMcap"); if (mMcap) mMcap.textContent = (mcap !== null ? fmtUSD(mcap) : "TBA");
    const bs = el("pulseBS"); if (bs) bs.textContent = (buys !== null && sells !== null) ? `${buys} / ${sells}` : "—";
    const age = el("pulseAge"); if (age && !isOwnedByIndex(age)) age.textContent = humanAge(createdAt);

    const hEl = el("pulseHolders");
    if (hEl) {
      hEl.textContent = holders !== null ? fmtInt(holders) : "—";
      // Helpful tooltip for debugging / transparency
      if (holders === null && lastHoldersErr) hEl.title = `Holders unavailable (${lastHoldersErr})`;
      else hEl.title = "";
    }
    const aEl = el("pulseActive"); if (aEl) aEl.textContent = active !== null ? fmtInt(active) : "—";

    const sinceEl = el("pulseSince");
    if (sinceEl) {
      if (priceUsd !== null) {
        const pct = pctSinceBaseline(priceUsd);
        setPctBadge(sinceEl, pct);
      } else {
        sinceEl.textContent = "—";
      }
    }

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

    // Footnote sources (DexScreener + Etherscan)
    try {
      updatePulseNote({ chain: cfg.chain || 'ethereum', pair: cfg.pair || '', contract: cfg.contract || '' });
    } catch {}
  }


  // Lock critical Pulse fields against late overwrites by other scripts (race-condition safe).
  function lockPulseFields({ chain, pair, contract, createdAt, priceUsd, cfg }) {
    const ageEl = el("pulseAge");
    const priceEl = el("mPrice");
    const noteEl = document.querySelector("#pulseNote") || document.querySelector(".pulse-note") || null;

    const desiredAge = humanAge(createdAt);
    const desiredPrice = (priceUsd !== null && priceUsd !== undefined && Number.isFinite(Number(priceUsd)))
      ? (() => {
          setBaseline(priceUsd);
          const pct = pctSinceBaseline(priceUsd);
          return fmtUSD(priceUsd) + (pct !== null ? ` (${fmtPct(pct)})` : "");
        })()
      : null;

    let suppress = false;

    const enforce = () => {
      try {
        suppress = true;
        if (ageEl && !isOwnedByIndex(ageEl) && desiredAge && ageEl.textContent !== desiredAge) ageEl.textContent = desiredAge;
        if (priceEl && !isOwnedByIndex(priceEl) && desiredPrice && priceEl.textContent !== desiredPrice) priceEl.textContent = desiredPrice;
        // Ensure sources footnote stays present (some renderers reset innerHTML)
        if (noteEl) updatePulseNote({ chain, pair, contract });
      } finally {
        suppress = false;
      }
    };

    // Run a few times after load (most overwrites happen within first 2-3s)
    const schedule = [250, 800, 1500, 2500, 4000];
    for (const ms of schedule) setTimeout(enforce, ms);

    // Also observe for any changes and revert immediately.
    const targets = [ageEl, priceEl].filter(Boolean);
    // Note is updated via schedule + "only-if-changed" guard to avoid MutationObserver loops.
    if (!targets.length) return;

    const obs = new MutationObserver(() => {
      if (suppress) return;
      enforce();
    });

    for (const t of targets) {
      obs.observe(t, { childList: true, characterData: true, subtree: true });
    }

    // Safety: stop observing after 15s (page should be stable).
    setTimeout(() => { try { obs.disconnect(); } catch {} }, 15000);
  }

  async function run(cfg) {
    // Accept config from multiple shapes/keys (back-compat)
    const ds = cfg.DEXSCREENER || {};
    const chain = String(cfg.DEXSCREENER_CHAIN || ds.chain || "ethereum").toLowerCase();
    const pair = cfg.DEX_PAIR_ADDRESS || ds.pair || cfg.DEX_PAIR || "";
    const contract = cfg.CONTRACT_ADDRESS || cfg.TOKEN_CONTRACT || "";
    const apiKey = cfg.ETHERSCAN_API_KEY || cfg.ETHERSCAN_KEY || "";

    if (!pair) return;

    try {
      const dexPair = await fetchDexPair(chain, pair);
      const holders = await fetchHoldersEtherscan(contract, apiKey);
      applyValues(dexPair, holders, cfg);
      // Prevent late overwrites (race with other site scripts)
      lockPulseFields({ chain, pair, contract, createdAt: (dexPair && dexPair.pairCreatedAt) ? Number(dexPair.pairCreatedAt) : null, priceUsd: (dexPair && dexPair.priceUsd) ? Number(dexPair.priceUsd) : null, cfg });
    } catch (e) {
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
      const cfg = window.CAPI_CONFIG || window.__CAPI_CONFIG__ || window.CFG || null;
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
