/**
 * capi-ui.js (v19)
 * Minimal, SAFE UI sync for the Hero Trust Bar.
 * - Works even if trust-engine/market-engine are not ready yet.
 * - Never throws; fails silently.
 */
const DEFAULT_SCORE = 80;
const DEFAULT_MAX = 100;

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function setTrustUI(score, max){
  const s = clamp(Number(score)||DEFAULT_SCORE, 0, Number(max)||DEFAULT_MAX);
  const m = clamp(Number(max)||DEFAULT_MAX, 1, 1000);

  document.querySelectorAll("[data-capi-trustscore]").forEach(el => el.textContent = String(s));
  document.querySelectorAll("[data-capi-trustmax]").forEach(el => el.textContent = String(m));
  const pct = clamp((s/m)*100, 0, 100);

  document.querySelectorAll("[data-capi-trustfill]").forEach(el => {
    el.style.width = pct.toFixed(2) + "%";
  });
}

async function boot(){
  try{
    // If other engines expose a score, use it. Otherwise default.
    // (You can wire this later to real computed signals.)
    const globalAny = /** @type {any} */ (window);

    // Prefer a dynamic source if present
    const maybeScore = globalAny?.CAPI_TRUST_SCORE ?? globalAny?.__CAPI_TRUST_SCORE ?? null;
    const maybeMax   = globalAny?.CAPI_TRUST_MAX ?? globalAny?.__CAPI_TRUST_MAX ?? null;

    setTrustUI(maybeScore ?? DEFAULT_SCORE, maybeMax ?? DEFAULT_MAX);
  }catch(_e){
    // never throw
    setTrustUI(DEFAULT_SCORE, DEFAULT_MAX);
  }
}

if (document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", boot, { once: true });
}else{
  boot();
}
