/*
  trust-engine.js (FIX v13)
  - Works on GitHub Pages under /capitoken-site/
  - Updates BOTH:
      #trustScoreHero, #trustBarFill, #trustHintHero, #trustStatusHero
      #trustScoreTile
  - Never injects extra "100" text or duplicate labels.
*/

(function () {
  const $ = (sel) => document.querySelector(sel);

  const el = {
    badge: $("#trustBadgeHero"),
    status: $("#trustStatusHero"),

    scoreHero: $("#trustScoreHero"),
    barFill: $("#trustBarFill"),
    hintHero: $("#trustHintHero"),

    scoreTile: $("#trustScoreTile"),
  };

  function setText(node, value) {
    if (!node) return;
    node.textContent = value;
  }

  function setBar(pct) {
    if (!el.barFill) return;
    const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
    el.barFill.style.width = `${clamped}%`;

    // accessibility if wrapper exists
    const wrap = el.barFill.closest('[role="progressbar"]');
    if (wrap) wrap.setAttribute("aria-valuenow", String(clamped));
  }

  function setState(kind, text) {
    // kind: ok | warn | bad | neutral
    if (el.badge) {
      el.badge.setAttribute("data-state", kind);
    }
    setText(el.status, text);
  }

  function readConfig() {
    // Prefer JS config loaded from /public/js/capi-config.js
    const cfg = (window && window.CAPI_CONFIG) ? window.CAPI_CONFIG : {};

    // Optional: read from hero data-* attributes
    const hero = document.querySelector(".hero");
    const token = hero?.getAttribute("data-token") || cfg.tokenAddress || "";
    const pair = hero?.getAttribute("data-pair") || cfg.dexPairAddress || "";

    return {
      tokenAddress: String(token || "").trim(),
      dexPairAddress: String(pair || "").trim(),
      officialUrl: String(cfg.officialUrl || "").trim(),
      registryUrl: String(cfg.registryUrl || "").trim(),
    };
  }

  async function loadRegistry(url) {
    if (!url) return null;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  function computeTrust({ cfg, registry }) {
    // Minimal, deterministic trust score (no crazy heuristics)
    // 80 baseline if page loads; +10 if registry exists; +10 if token matches registry
    let score = 80;
    let hint = "Read-only verification. Never sign prompts.";

    if (registry) {
      score += 10;
      hint = "Official registry detected.";

      // Support a couple of shapes: {token, pair} OR {tokenAddress, dexPairAddress}
      const regToken = String(registry.token || registry.tokenAddress || "").toLowerCase();
      const regPair = String(registry.pair || registry.dexPairAddress || "").toLowerCase();
      const token = String(cfg.tokenAddress || "").toLowerCase();
      const pair = String(cfg.dexPairAddress || "").toLowerCase();

      if (token && regToken && token === regToken) score += 5;
      if (pair && regPair && pair === regPair) score += 5;

      score = Math.min(100, score);

      if (token && regToken && token !== regToken) {
        hint = "Registry mismatch: token address differs. Verify /links and URL.";
        score = Math.max(20, score - 30);
      }
    } else {
      hint = "No registry found yet. Treat all links as unofficial unless listed here.";
    }

    // If no token configured, do not show 100-ish
    if (!cfg.tokenAddress) {
      score = Math.min(score, 80);
      hint = "Token not configured yet. Waiting for official addresses.";
    }

    return { score, hint };
  }

  async function main() {
    // If UI elements are missing, do nothing.
    const hasAny = el.status || el.scoreHero || el.scoreTile || el.barFill;
    if (!hasAny) return;

    setState("neutral", "Checking trust…");
    setText(el.hintHero, "Loading official registry…");

    const cfg = readConfig();

    // Registry URL: from config OR /official-registry.json under BASE
    const base = (document.querySelector("base")?.href) || (import.meta && import.meta.env && import.meta.env.BASE_URL) || "/";
    const fallbackRegistry = new URL("official-registry.json", window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "/")).toString();

    const registryUrl = cfg.registryUrl || fallbackRegistry;

    const registry = await loadRegistry(registryUrl);
    const { score, hint } = computeTrust({ cfg, registry });

    setText(el.scoreHero, String(score));
    setText(el.scoreTile, String(score));
    setBar(score);

    setText(el.hintHero, hint);

    if (score >= 90) setState("ok", "Verified source");
    else if (score >= 70) setState("warn", "Trusted (read-only)");
    else setState("bad", "Unverified — be careful");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
