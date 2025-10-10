(function(){
  const { TOKENS, CONTRACT_ADDRESS } = window.CAPI_CONFIG;

  function uniswapUrl(input, output){
    // Uniswap web app (v3)
    const base = "https://app.uniswap.org/#/swap";
    const p = new URLSearchParams({
      inputCurrency: input,
      outputCurrency: output
    });
    return `${base}?${p.toString()}`;
  }

  function setDexLinks(){
    if(!CONTRACT_ADDRESS || CONTRACT_ADDRESS.startsWith("0xYOUR_")) return;

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

  // Exponer por si luego reutilizamos
  window.CAPI_DEX = { uniswapUrl, setDexLinks };

  document.addEventListener("DOMContentLoaded", setDexLinks);
})();
