// public/js/capi-wallets.js
// Lightweight wallet helpers (safe on GitHub Pages). No deps.
(function(){
  function $(id){ return document.getElementById(id); }
  function short(a){ return a ? (a.slice(0,6)+'…'+a.slice(-4)) : ''; }
  function toast(msg){
    const el = $('toast');
    if(!el) return;
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(()=>{
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
    }, 1800);
  }

  function getTokenAddr(){
    const full = $('contractFull');
    const v = (full && full.textContent || '').trim();
    return (v && v.startsWith('0x') && v.length >= 10) ? v : '';
  }
  function getTokenMeta(){
    const sym = $('heroSymbol')?.textContent?.trim() || $('symbolPill')?.textContent?.trim() || 'CAPI';
    // decimals/image can be extended later; keep defaults safe
    return { symbol: sym || 'CAPI', decimals: 18 };
  }

  async function connectInjected(){
    try{
      if(!window.ethereum){ toast('No injected wallet detected'); return; }
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const a = accounts && accounts[0];
      if(!a) return;
      const pill = $('accountPill');
      if(pill) pill.style.display = 'inline-flex';
      const acct = $('acct');
      if(acct) acct.textContent = short(a);
      toast('Wallet connected');
    }catch(e){
      console.warn('connectInjected failed', e);
      toast('Wallet connect failed');
    }
  }

  async function watchToken(){
    try{
      const tokenAddr = getTokenAddr();
      if(!window.ethereum || !tokenAddr){ toast('Token not ready'); return; }
      const meta = getTokenMeta();
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: tokenAddr,
            symbol: meta.symbol,
            decimals: Number(meta.decimals || 18)
          }
        }
      });
      toast('Token added (if supported)');
    }catch(e){
      console.warn('watchToken failed', e);
      toast('Wallet declined / not supported');
    }
  }

  function wire(){
    const btnConnect = $('connectWalletBtn');
    if(btnConnect) btnConnect.addEventListener('click', (e)=>{ e.preventDefault(); connectInjected(); });

    const btnAdd = $('addToMetaMaskBtn');
    if(btnAdd) btnAdd.addEventListener('click', (e)=>{ e.preventDefault(); watchToken(); });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wire);
  }else{
    wire();
  }

  // Expose for debugging
  window.CAPI_WALLETS = { connectInjected, watchToken };
})();
