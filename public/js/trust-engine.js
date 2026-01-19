console.log("[TrustEngine] boot");

const RPC = window.CAPI_RPC_HTTP;

async function rpc(method, params = []) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  return (await r.json()).result;
}

async function initTrust() {
  const block = await rpc("eth_blockNumber");

  document.getElementById("launch-panel").innerHTML = `
    <h2>Trust Engine Online</h2>
    <p>RPC: Alchemy Mainnet</p>
    <p>Block: ${parseInt(block,16)}</p>
  `;
}

initTrust();
