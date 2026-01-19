// public/js/capi-dex.js
// Sets safe, official DEX links based on DOM values. No deps.
(function(){
  function $(id){ return document.getElementById(id); }
  function getAddr(id){
    const v = ($(id)?.textContent || '').trim();
    return (v.startsWith('0x') && v.length >= 10) ? v : '';
  }

  const WETH_MAINNET = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

  function setHref(id, href){
    const a = $(id);
    if(a && href){ a.setAttribute('href', href); }
  }

  function wire(){
    const token = getAddr('contractFull');
    const pair  = getAddr('pairFull');

    // Etherscan buttons (if present as <a>)
    setHref('etherscanContract', token ? `https://etherscan.io/token/${token}` : '');
    setHref('etherscanPair', pair ? `https://etherscan.io/address/${pair}` : '');

    // Uniswap swap links
    // token0/token1 order doesn't matter for UI; Uniswap will resolve.
    if(token){
      const uniSwap = `https://app.uniswap.org/#/swap?inputCurrency=${WETH_MAINNET}&outputCurrency=${token}`;
      const uniSwapReverse = `https://app.uniswap.org/#/swap?inputCurrency=${token}&outputCurrency=${WETH_MAINNET}`;

      setHref('buyOnUniswap', uniSwap);
      setHref('routeWethCapi', uniSwap);
      setHref('routeCapiWeth', uniSwapReverse);

      // If there is a "Live Market" link, point to Dexscreener if pair known, else token.
      const dex = pair
        ? `https://dexscreener.com/ethereum/${pair}`
        : `https://dexscreener.com/ethereum/${token}`;
      setHref('liveMarket', dex);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wire);
  }else{
    wire();
  }

  window.CAPI_DEX = { wire };
})();

    map.forEach(([id, token])=>{
      const a = document.getElementById(id);
      if(a) a.href = uniswapUrl(token, CONTRACT_ADDRESS);
    });
  }

  window.CAPI_DEX = { uniswapUrl, setDexLinks };
  document.addEventListener("DOMContentLoaded", setDexLinks);
})();
