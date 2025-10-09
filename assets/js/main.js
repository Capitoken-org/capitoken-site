// --- Navegación móvil ---
const menuBtn = document.getElementById('menu');
if (menuBtn) {
  menuBtn.addEventListener('click', () => {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    const open = getComputedStyle(nav).display !== 'none';
    nav.style.display = open ? 'none' : 'flex';
  });
}

// --- Utilidad: construir enlaces DEX / Etherscan ---
// Reemplaza el valor del contrato aquí (cuando lo tengas)
const CONTRACT = '0xTU_CONTRATO_AQUI'; // <= cambia esto y se actualiza todo
const TOKENS = {
  ETH: 'ETH',
  USDC: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
};

function uniswapUrl(input, output){
  return `https://app.uniswap.org/#/swap?inputCurrency=${encodeURIComponent(input)}&outputCurrency=${encodeURIComponent(output)}`;
}

function setIfExists(id, href){
  const el = document.getElementById(id);
  if (el && href) el.href = href;
}

// Pintar contract y enlaces
(function initContract(){
  const addrEl = document.getElementById('tokenAddress');
  if (addrEl && CONTRACT && CONTRACT.startsWith('0x') && CONTRACT.length === 42){
    addrEl.textContent = CONTRACT;
    setIfExists('etherscan', `https://etherscan.io/token/${CONTRACT}`);
    setIfExists('uniswap',  uniswapUrl(TOKENS.ETH, CONTRACT));
    setIfExists('uniswapDirect', uniswapUrl(TOKENS.ETH, CONTRACT));
    setIfExists('usdcDirect',    uniswapUrl(TOKENS.USDC, CONTRACT));
    setIfExists('usdtDirect',    uniswapUrl(TOKENS.USDT, CONTRACT));
  }
})();

// Copiar address
const copyBtn = document.getElementById('copyAddr');
if (copyBtn){
  copyBtn.addEventListener('click', async () => {
    const addr = document.getElementById('tokenAddress')?.textContent?.trim();
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
      copyBtn.textContent = '¡Copiado!';
      setTimeout(()=>copyBtn.textContent='Copiar', 1500);
    } catch {
      alert('No se pudo copiar. Copia manual: ' + addr);
    }
  });
}
