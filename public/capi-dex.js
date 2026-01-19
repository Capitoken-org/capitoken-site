// Capitoken — capi-dex.js
// Minimal helper to wire DEX buttons/routes if present.

export function initCapiDex(options = {}) {
  const btns = document.querySelectorAll("[data-dex-route]");
  if (!btns.length) return;

  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      const href = btn.getAttribute("data-dex-route");
      if (!href) return;
      window.open(href, "_blank", "noopener,noreferrer");
    });
  });
}

try { initCapiDex(); } catch (e) { /* noop */ }
