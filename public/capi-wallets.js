// Capitoken — capi-wallets.js
// Lightweight, safe module: no imports; just DOM wiring.
// This file MUST exist in /public/js so GitHub Pages serves it as application/javascript.

export function initCapiWallets(options = {}) {
  const rootSelector = options.rootSelector || "[data-wallet-hangar]";
  const root = document.querySelector(rootSelector);
  if (!root) return;

  // If the page already rendered wallet cards server-side, do nothing.
  if (root.querySelector("[data-wallet-card]")) return;

  const wallets = (options.wallets && Array.isArray(options.wallets)) ? options.wallets : [
    { name: "MetaMask", url: "https://metamask.io/", note: "Browser / Mobile" },
    { name: "Trust Wallet", url: "https://trustwallet.com/", note: "Mobile" },
    { name: "Coinbase Wallet", url: "https://www.coinbase.com/wallet", note: "Browser / Mobile" },
    { name: "Rainbow", url: "https://rainbow.me/", note: "Mobile" },
    { name: "Rabby", url: "https://rabby.io/", note: "Browser" },
    { name: "Phantom", url: "https://phantom.app/", note: "Multi-chain" },
    { name: "WalletConnect", url: "https://walletconnect.com/", note: "Connector" },
    { name: "Safe", url: "https://safe.global/", note: "Multisig" }
  ];

  const frag = document.createDocumentFragment();
  wallets.forEach(w => {
    const a = document.createElement("a");
    a.href = w.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "wallet-card";
    a.setAttribute("data-wallet-card", "1");

    const title = document.createElement("div");
    title.className = "wallet-title";
    title.textContent = w.name;

    const note = document.createElement("div");
    note.className = "wallet-note";
    note.textContent = w.note || "";

    a.appendChild(title);
    a.appendChild(note);
    frag.appendChild(a);
  });

  root.appendChild(frag);
}

// Auto-init (non-breaking)
try { initCapiWallets(); } catch (e) { /* noop */ }
