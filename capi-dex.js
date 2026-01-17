(function(){
  const cfg = window.CAPI_CONFIG || {};
  const { TOKENS, CONTRACT_ADDRESS } = cfg;

  function uniswapUrl(input, output){
    const base = "https://app.uniswap.org/#/swap";
    const p = new URLSearchParams({
      inputCurrency: input,
      outputCurrency: output
    });
    return `${base}?${p.toString()}`;
  }

  function isAddress(a){
    return typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a);
  }

  function setDexLinks(){
    if(!isAddress(CONTRACT_ADDRESS)) return;

    const map = [
      ["dexEth",  TOKENS.ETH],
      ["dexUsdc", TOKENS.USDC],
      ["dexUsdt", TOKENS.USDT],
      ["dexDai",  TOKENS.DAI],
    ];

    map.forEach(([id, token])=>{
      const a = document.getElementById(id);
      if(a) a.href = uniswapUrl(token, CONTRACT_ADDRESS);
    });
  }

  window.CAPI_DEX = { uniswapUrl, setDexLinks };
  document.addEventListener("DOMContentLoaded", setDexLinks);
})();
